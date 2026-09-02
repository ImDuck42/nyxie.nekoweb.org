# 🌐 nyxie.nekoweb.org

[![Website](https://img.shields.io/badge/Website-nyxie.nekoweb.org-ff79c6?style=for-the-badge&logo=google-chrome&logoColor=white)](https://nyxie.nekoweb.org)
[![GitHub Action](https://img.shields.io/badge/Workflow-Mirror%20Action-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](./sourceWorkflow/mirror.yml)

> **The central repository for [nyxie.nekoweb.org](https://nyxie.nekoweb.org)**

> This repository is designed to be the target destination for my projects,  
> Using the custom [Mirror Workflow](./sourceWorkflow/mirror.yml), you can automatically sync and transform content from any source repository to a NekoWeb compatible version

---

## How It Works
```
┌─────────────────────────┐                                 ┌─────────────────────────┐
│   Source Repository     │          GitHub Actions         │    Target Repository    │
│   (e.g. Gallery Repo)   │  ─────────────────────────────► │   (nyxie.nekoweb.org)   │
│      +nekoweb.json      │   *Filters, transforms, moves   │ (The GitHub Repository) │
└─────────────────────────┘                                 └─────────────────────────┘
```

> [!IMPORTANT]  
> The [mirror.yml](./sourceWorkflow/mirror.yml) workflow must be placed in your **source repository** (not in the target mirrored Repository)

---

## Configuration (`nekoweb.json`)
To customize how files are copied over, place a `nekoweb.json` file anywhere in your **source repository**  
This allows you to exclude files, move/rename assets, and replace URLs in the mirroring process

### Example Configuration
```json
{
  "movements": {
    "/assets/nekoweb/elements.css": "/elements.css"
  },
  "exclusions": [
    ".git",
    ".github",
    "readme*",
    "!Backup",
    "!Plugin",
    "license*",
    ".gitignore",
    "assets/nekoweb/",
    "assets/images/image?*.png"
  ],
  "renames": {
    "404.html": "not_found.html"
  },
  "replacements": {
    "https://imduck42.github.io/Gallery/assets/construction-vecteezy.svg": "https://nyxie.nekoweb.org/assets/construction-vecteezy.svg",
    "https://imduck42.github.io/Gallery/assets/images/voahOhVoah.png"    : "https://nyxie.nekoweb.org/assets/images/voahOhVoah.png",
    "https://imduck42.github.io/Gallery/assets/gallery-svgrepo.svg"      : "https://nyxie.nekoweb.org/assets/gallery-svgrepo.svg",
    "https://imduck42.github.io/Gallery/assets/images/image.png"         : "https://nyxie.nekoweb.org/assets/images/image.png",
    "https://imduck42.github.io/Gallery/assets/cli"                      : "https://nyxie.nekoweb.org/assets/cli",
    "https://imduck42.github.io/Gallery/server.py"                       : "https://nyxie.nekoweb.org/server.py",
    "https://imduck42.github.io/Gallery/"                                : "https://nyxie.nekoweb.org",
    "imduck42.github.io/Gallery"                                         : "nyxie.nekoweb.org"
  }
}
```
*(Example taken from my [Gallery](https://github.com/ImDuck42/Gallery) repository)*

### Option Breakdown

| Key            | Description                                                                                      |
| :------------- | :----------------------------------------------------------------------------------------------- |
| `movements`    | Moves files or directories from one path to another within the target                            |
| `exclusions`   | Patterns or Names of files/folders to omit from the sync                                         |
| `renames`      | Key-Value mapping to rename files during the mirror step                                         |
| `replacements` | String replacements across synced files (useful for updating URLs, domain names, or asset paths) |

> [!TIP]  
> The actions are performed in descending order(Top to Bottom): **Movements -> Exclusions-> Renames -> Replacements**

---

## Setting Up the Workflow

### 1. Configure Environment Variables

In your source repository's `.github/workflows/mirror.yml`, configure the target details:

```yaml
env:
  TARGET_USER: "ImDuck42"          # Target GitHub username/organization
  TARGET_REPO: "nyxie.nekoweb.org" # Target repository name
  TARGET_DIR:  "nyxie.nekoweb.org" # Root folder to place files inside the target repository
```

> [!TIP]  
> If you are using **Deploy2Nekoweb** within your mirrored Repository, files are placed into the root `nyxie.nekoweb.org/` folder of your NekoWeb domain  
> Also D2N will by default look for a folder called `public` in the root of your mirrored repository, make sure to change it if needed  
> If you want to mirror into a sub-folder (e.g., `nyxie.nekoweb.org/gallery`), change `TARGET_DIR` to `nyxie.nekoweb.org/gallery`

> remember to change nyxie.nekoweb.org to your own repository and file-path if you are mirroring to your own repo

---

### 2. Set Up Secrets

For the mirror workflow to push to the target repo:

1. Create a **Fine-grained Personal Access Token (PAT)**:
   * Go to [GitHub Token Settings](https://github.com/settings/personal-access-tokens/new)
   * Grant **Contents: Read and Write** permissions for the target repository (`nyxie.nekoweb.org`)
2. Add the token to your **source repository**:
   * Navigate to **Settings** > **Secrets and variables** > **Actions**
   * Create a new repository secret named:
     ```
     DEPLOY_TOKEN
     ```
   * Paste your fine-grained PAT as the secret value
