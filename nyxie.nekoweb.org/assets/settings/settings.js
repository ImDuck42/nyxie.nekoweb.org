// ==================================================================================================== //
// GALLERY SERVER SETTINGS
// ==================================================================================================== //
function setServerAdress(serverURL, serverPort) {
  const newAdress = serverURL.concat(':', serverPort)
  localStorage.setItem('serverAdress', newAdress)

  console.log(`[API] Set new Gallery Server URL to: ${newAdress}`);
}

function populateSettingsAdress() {
  const storedAddress = localStorage.getItem('serverAdress');
  if (!storedAddress) return; 

  try {
    const address   = new URL(storedAddress);
    const urlValue  = `${address.protocol}//${address.hostname}`;
    const portValue = address.port || '';
    
    window.SettingsAPI.updateSetting('serverURL',  { default: urlValue });
    window.SettingsAPI.updateSetting('serverPort', { default: portValue });
    
    console.log(`[API] Settings populated with: ${urlValue} and port ${portValue}`);
  } catch (error) {
    console.error("[API] Saved address is not a valid URL.", error);
  }
} setTimeout(populateSettingsAdress); // Execute imediately

function downloadServer() {
  const serverAdress = 'https://nyxie.nekoweb.org/server.py';
  const downloadLink = document.createElement('a');
  
  downloadLink.href     = serverAdress;
  downloadLink.download = 'server.py';
  
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

// ==================================================================================================== //
// DEVELOPER OPTIONS
// ==================================================================================================== //
async function loadExternalSettingsFromUrl(jsonUrl) {
  if (!jsonUrl) {
    console.warn('[API] No URL provided.');
    return;
  }

  console.log(`[API] Fetching external settings from: ${jsonUrl}`);

  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log('[API] Successfully loaded settings JSON:', data);

    if (data.imports) {
      // Resolve the import path relative to the JSON file's URL
      // For example, if jsonUrl is "https://imduck42.github.io/random/settings.json" and
      // data.imports is "./settings.js", it resolves to "https://imduck42.github.io/random/settings.js"
      const baseUrl       = new URL(jsonUrl, window.location.href);
      const resolvedJsUrl = new URL(data.imports, baseUrl).href;
      
      console.log(`[API] Dynamically loading associated JS: ${resolvedJsUrl}`);
      await injectScript(resolvedJsUrl);
    }

    if (typeof appendAndRenderSettings === 'function') {
      appendAndRenderSettings(data.sections || []);
    } else {
      console.warn('[Dev] Settings loaded, but "appendAndRenderSettings" parser hook is missing.');
      alert('Settings loaded successfully! Connect "appendAndRenderSettings" to update your UI.');
    }

    const urls = JSON.parse(localStorage.getItem('imports') || '[]');
    if (!urls.includes(jsonUrl)) {
      urls.push(jsonUrl);
      localStorage.setItem('imports', JSON.stringify(urls));
      populateImportedSettingsDropdown(); // Solutionary? addition
    }

  } catch (error) {
    console.error('[API] Failed to fetch external config:', error);
    alert(`Error loading settings: ${error.message}`);
  }
}

if (document.readyState !== 'loading') {
  const urls = JSON.parse(localStorage.getItem('imports') || '[]');
  urls.forEach(url => loadExternalSettingsFromUrl(url));
}

// Helper to inject script tags into the document
function injectScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      console.log(`[API] Script already loaded: ${src}`);
      resolve();
      return;
    }

    const script  = document.createElement('script');
    script.src    = src;
    script.type   = 'text/javascript';
    script.onload = () => {
      console.log(`[API] Script successfully evaluated: ${src}`);
      resolve();
    };
    script.onerror = () => {
      reject(new Error(`Failed to load script resource: ${src}`));
    };

    document.head.appendChild(script);
  });
}


// Solution for now, not the most pretty
function populateImportedSettingsDropdown() {
  const urls       = JSON.parse(localStorage.getItem('imports') || '[]');
  const newOptions = urls.length > 0 
    ? urls.map(url => ({ value: url, label: url })) 
    : [{ value: '', label: 'No imported settings' }];

  window.SettingsAPI.updateSetting('settingsSelector', {
    options: newOptions,
    default: newOptions[0].value
  });
} setTimeout(populateImportedSettingsDropdown); // Execute immediately

async function deleteSetting() {
  const wrapper         = document.getElementById('settingsSelector')?.closest('.dropdown');
  const selectedSetting = wrapper?.querySelector('.options .selected')?.dataset.value;
  
  if (!selectedSetting) return;

  const urls        = JSON.parse(localStorage.getItem('imports') || '[]');
  const updatedUrls = urls.filter(url => url !== selectedSetting);

  localStorage.setItem('imports', JSON.stringify(updatedUrls));
  populateImportedSettingsDropdown();

  try {
    const response = await fetch(selectedSetting);
    if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

    const data = await response.json();
    (data.sections || []).forEach((section) => {
      document.querySelector(`${SELECTORS.settingsPage} .section[data-section-id="${section.id}"]`)?.remove();
    });
  } catch (error) {
    console.error('[API] Failed to remove settings from the page:', error);
  }
}