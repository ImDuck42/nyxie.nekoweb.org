#!/usr/bin/env python3
# Doesn't need any pip packages
# Ignores .hidden folders by default
""" Instructions:
  -> Place this file in the root images folder and start it
"""

import os
import ssl
import sys
import json
import time
import shutil
import socket
import hashlib
import mimetypes
import threading
import subprocess
import urllib.parse

from pathlib     import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEFAULT_HTTP_PORT  = 4269
DEFAULT_HTTPS_PORT = 4270
IMAGE_EXTENSIONS   = {".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}

ACCENT_NAMES = [
  "rosewater", "flamingo", "pink", "mauve", "red",      "maroon", "peach",
  "yellow",    "green",    "teal", "sky",   "sapphire", "blue",   "lavender",
]

def get_local_ip():
  try:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
      sock.connect(("8.8.8.8", 80))
      return sock.getsockname()[0]
  except Exception:
    return socket.gethostbyname(socket.gethostname())

def is_image_file(path):
  return path.suffix.lower() in IMAGE_EXTENSIONS

def find_image_folders(root):
  folders = {}

  for current_directory, subdirectory_names, file_names in os.walk(root):
    subdirectory_names[:] = [name for name in subdirectory_names if not name.startswith('.')]
    directory_path        = Path(current_directory)

    image_paths = sorted(
      directory_path / file_name
      for file_name in file_names
      if is_image_file(directory_path / file_name)
    )

    if image_paths:
      folder_name          = directory_path.name
      folders[folder_name] = image_paths

  return folders

def accent_for_folder(folder_name):
  digest = hashlib.sha1(folder_name.encode("utf-8")).hexdigest()
  return ACCENT_NAMES[int(digest, 16) % len(ACCENT_NAMES)]

def build_folder_manifest(folders):
  manifest = []
  for folder_name, image_paths in folders.items():
    total_bytes = 0
    image_data  = []

    for path in image_paths:
      size         = path.stat().st_size
      total_bytes += size
      image_data.append({"name": path.name, "size": size})

    manifest.append({
      "name":      folder_name,
      "fileCount": len(image_paths),
      "sizeMB":    round(total_bytes / (1024 * 1024), 1),
      "accent":    accent_for_folder(folder_name),
      "images":    image_data,
    })
  return manifest

class GalleryRequestHandler(BaseHTTPRequestHandler):
  folders = {}

  def send_cors_headers(self):
    self.send_header("Access-Control-Allow-Origin", "*")

  def do_OPTIONS(self):
    self.send_response(204)
    self.send_cors_headers()
    self.end_headers()

  def do_GET(self):
    self.handle_request(send_body=True)

  def do_HEAD(self):
    self.handle_request(send_body=False)

  def handle_request(self, send_body):
    request = urllib.parse.urlparse(self.path)
    query   = urllib.parse.parse_qs(request.query)

    if request.path == "/folders":
      self.respond_with_manifest(send_body)
    elif request.path == "/image":
      self.respond_with_image(query, send_body)
    else:
      self.send_error(404,  f"Unknown endpoint '{request.path}'. Available endpoints: '/folders', '/image?folder=<folder_name>&file=<file_name>'")

  def respond_with_manifest(self, send_body):
    GalleryRequestHandler.folders = find_image_folders(GalleryRequestHandler.root)
    body                          = json.dumps(build_folder_manifest(self.folders)).encode("utf-8")

    self.send_response(200)
    self.send_header("Content-Type",   "application/json")
    self.send_header("Content-Length", str(len(body)))
    self.send_cors_headers()
    self.end_headers()
    if send_body:
      self.wfile.write(body)

  def respond_with_image(self, query, send_body):
    folder_name = query.get("folder", [None])[0]
    file_name   = query.get("file",   [None])[0]

    image_paths = self.folders.get(folder_name, [])
    image_path  = next((path for path in image_paths if path.name == file_name), None)

    if not image_path:
      self.send_error(404, "Missing required query parameters. Usage: /image?folder=<folder_name>&file=<file_name>")
      return

    try:
      file_size    = image_path.stat().st_size
      content_type = mimetypes.guess_type(image_path.name)[0]

      self.send_response(200)
      self.send_header("Content-Type",   content_type)
      self.send_header("Content-Length", str(file_size))
      self.send_header("Cache-Control",  "public, max-age=86400")
      self.send_cors_headers()
      self.end_headers()

      if send_body:
        with open(image_path, "rb") as f:
          shutil.copyfileobj(f, self.wfile)

    except Exception as e:
      self.log_message("Error serving %s: %s", file_name, str(e))

  def log_message(self, format_string, *args):
    if "GET /image" in format_string % args or "HEAD /image" in format_string % args:
      return
    print(f"[gallery-server] {self.address_string()} - {format_string % args}")

def cleanup_cert_dir(cert_dir):
  if cert_dir and cert_dir.exists():
    shutil.rmtree(cert_dir)
    print(f"[gallery-server] Removed certificate directory: {cert_dir}")

def generate_certificates(cert_dir):
  cert_path = cert_dir / "cert.pem"
  key_path  = cert_dir / "key.pem"

  if cert_dir.exists():
    shutil.rmtree(cert_dir)
  cert_dir.mkdir(parents=True, exist_ok=True)

  cmd = [
    "openssl", "req", "-x509", "-newkey", "rsa:2048",
    "-keyout", str(key_path), "-out", str(cert_path),
    "-days",   "365", "-nodes",
    "-subj",   "/CN=localhost"
  ]
  
  try:
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"[gallery-server] Generated self‑signed certificate in {cert_dir}")
  except Exception as error:
    print(f"[gallery-server] Failed to generate certificate with openssl: {error}", file=sys.stderr)
    sys.exit(1)

  return cert_path, key_path

def start_server(server_class, handler_class, address, port, ssl_context=None):
  server = server_class((address, port), handler_class)
  if ssl_context:
    server.socket = ssl_context.wrap_socket(server.socket, server_side=True)
  return server

def main():
  root       = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path("./").resolve()
  http_port  = int(sys.argv[2])            if len(sys.argv) > 2 else DEFAULT_HTTP_PORT
  https_port = int(sys.argv[3])            if len(sys.argv) > 3 else DEFAULT_HTTPS_PORT

  GalleryRequestHandler.root    = root
  GalleryRequestHandler.folders = find_image_folders(root)
  folder_count = len(GalleryRequestHandler.folders)
  image_count  = sum(len(images) for images in GalleryRequestHandler.folders.values())
  print(f"Serving {folder_count} folders ({image_count} images) from {root}")

  cert_dir            = Path.cwd() / ".cert"
  cert_path, key_path = generate_certificates(cert_dir)

  ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
  ssl_context.load_cert_chain(certfile=str(cert_path), keyfile=str(key_path))

  httpd  = start_server(ThreadingHTTPServer, GalleryRequestHandler, "0.0.0.0", http_port,  ssl_context=None)
  httpsd = start_server(ThreadingHTTPServer, GalleryRequestHandler, "0.0.0.0", https_port, ssl_context=ssl_context)

  http_thread  = threading.Thread(target=httpd.serve_forever,  daemon=True)
  https_thread = threading.Thread(target=httpsd.serve_forever, daemon=True)
  http_thread.start()
  https_thread.start()

  local_ip = get_local_ip()
  print(f"\nGallery server running at:")
  print(f"  -> http://{local_ip}:{http_port}")
  print(f"  -> https://{local_ip}:{https_port}\n")
  print(f"For HTTPS, visit the link first and accept the not secure warning")
  print("(Use these URLs from other devices in this Wi‑Fi)\n")

  try:
    while True:
      time.sleep(1)
  except KeyboardInterrupt:
    pass
  finally:
    print("[gallery-server] Shutting down servers...")
    httpd.shutdown()
    httpsd.shutdown()
    httpd.server_close()
    httpsd.server_close()
    cleanup_cert_dir(cert_dir)

if __name__ == "__main__":
  main()