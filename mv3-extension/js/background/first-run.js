// CivicPlus Toolkit - First Run Handler (MV3)
// Handles extension installation and update events

/**
 * Version comparison utility
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal, NaN if invalid
 * Source: https://stackoverflow.com/a/6832721
 */
function versionCompare(v1, v2, options) {
  const lexicographical = options && options.lexicographical;
  const zeroExtend = options && options.zeroExtend;
  let v1parts = v1.split('.');
  let v2parts = v2.split('.');

  function isValidPart(x) {
    return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
  }

  if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
    return NaN;
  }

  if (zeroExtend) {
    while (v1parts.length < v2parts.length) v1parts.push('0');
    while (v2parts.length < v1parts.length) v2parts.push('0');
  }

  if (!lexicographical) {
    v1parts = v1parts.map(Number);
    v2parts = v2parts.map(Number);
  }

  for (let i = 0; i < v1parts.length; ++i) {
    if (v2parts.length === i) {
      return 1;
    }

    if (v1parts[i] === v2parts[i]) {
      continue;
    } else if (v1parts[i] > v2parts[i]) {
      return 1;
    } else {
      return -1;
    }
  }

  if (v1parts.length !== v2parts.length) {
    return -1;
  }

  return 0;
}

/**
 * Load a JSON file from the extension package
 * @param {string} path - Path to the JSON file (relative to extension root)
 * @returns {Promise<Object>} Parsed JSON data
 */
async function loadJSON(path) {
  const url = chrome.runtime.getURL(path);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Initialize default settings for on-load tools from JSON config
 */
async function initializeOnLoadToolDefaults() {
  try {
    const tools = await loadJSON('/data/on-load-tools.json');
    const defaults = {};
    
    for (const [key, value] of Object.entries(tools)) {
      defaults[key] = value['enabled-by-default'];
    }
    
    await chrome.storage.local.set(defaults);
    console.log('[CP Toolkit] Initialized', Object.keys(defaults).length, 'on-load tool defaults');
  } catch (error) {
    console.error('[CP Toolkit] Failed to initialize on-load tool defaults:', error);
  }
}

/**
 * Initialize only NEW on-load tools (for updates - don't overwrite user preferences)
 */
async function initializeNewOnLoadTools() {
  try {
    const tools = await loadJSON('/data/on-load-tools.json');
    const existingSettings = await chrome.storage.local.get(null);
    const updates = {};
    
    for (const [key, value] of Object.entries(tools)) {
      // Only set default if the key doesn't exist in storage
      if (existingSettings[key] === undefined) {
        updates[key] = value['enabled-by-default'];
        console.log('[CP Toolkit] Adding new tool default:', key, '=', value['enabled-by-default']);
      }
    }
    
    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
      console.log('[CP Toolkit] Set defaults for', Object.keys(updates).length, 'new tools');
    }
  } catch (error) {
    console.error('[CP Toolkit] Failed to initialize new on-load tools:', error);
  }
}

/**
 * Initialize default favorite modules from JSON config
 */
async function initializeModuleFavorites() {
  try {
    const modules = await loadJSON('/data/modules.json');
    
    // For each module class (Content, Site Tools, Live Edit)
    for (const [className, classModules] of Object.entries(modules)) {
      const classFavorites = {};
      
      // For each module in the class
      for (const [moduleName, moduleData] of Object.entries(classModules)) {
        // If it's a default favorite, add it
        if (moduleData['default-favorite']) {
          classFavorites[moduleName] = moduleData['default-icon'];
        }
      }
      
      // Save favorites for this class if any exist
      if (Object.keys(classFavorites).length > 0) {
        console.log('[CP Toolkit] Saving favorite', className, 'modules:', Object.keys(classFavorites));
        await chrome.storage.sync.set({ [className]: classFavorites });
      }
    }
  } catch (error) {
    console.error('[CP Toolkit] Failed to initialize module favorites:', error);
  }
}

/**
 * Show changelog if enabled and there's a newer version
 * @param {string} previousVersion - The previous extension version (for updates)
 */
async function showChangelogIfNeeded(previousVersion) {
  try {
    const result = await chrome.storage.local.get(['show-changelog', 'lastViewedChangelog']);
    
    // Default to true if not set (show changelog by default)
    const showChangelog = result['show-changelog'] !== false;
    
    if (showChangelog) {
      const lastViewed = result['lastViewedChangelog'] || '0.0.0';
      const currentVersion = chrome.runtime.getManifest().version;
      
      // If current version is newer than last viewed, show changelog
      if (versionCompare(currentVersion, lastViewed) === 1) {
        const changelogUrl = chrome.runtime.getURL(`/html/changelog.html?prev=${lastViewed}`);
        await chrome.tabs.create({ url: changelogUrl });
        console.log('[CP Toolkit] Opened changelog for version', currentVersion, '(previous:', lastViewed, ')');
        
        // Update last viewed version
        await chrome.storage.local.set({ lastViewedChangelog: currentVersion });
      }
    }
  } catch (error) {
    console.error('[CP Toolkit] Failed to show changelog:', error);
  }
}

/**
 * Handle first-time installation
 */
async function handleInstall() {
  console.log('[CP Toolkit] Handling first-time installation...');
  
  // Open the help/welcome page
  const helpUrl = chrome.runtime.getURL('/html/help.html?firstrun=true');
  await chrome.tabs.create({ url: helpUrl });
  console.log('[CP Toolkit] Opened help page for first run');
  
  // Initialize all default settings
  await initializeOnLoadToolDefaults();
  
  // Initialize favorite modules
  await initializeModuleFavorites();
  
  // Set initial changelog version to current (don't show changelog on fresh install)
  const currentVersion = chrome.runtime.getManifest().version;
  await chrome.storage.local.set({ lastViewedChangelog: currentVersion });
  
  console.log('[CP Toolkit] First-time installation complete');
}

/**
 * Handle extension update
 * @param {string} previousVersion - The previous extension version
 */
async function handleUpdate(previousVersion) {
  console.log('[CP Toolkit] Handling update from version', previousVersion);
  
  // Initialize any new tools that weren't in previous version
  await initializeNewOnLoadTools();
  
  // Show changelog if enabled
  await showChangelogIfNeeded(previousVersion);
  
  console.log('[CP Toolkit] Update handling complete');
}

/**
 * Main handler for runtime.onInstalled event
 * @param {Object} details - Installation details from Chrome
 */
async function onInstalledHandler(details) {
  console.log('[CP Toolkit] onInstalled event:', details.reason);
  
  if (details.reason === 'install') {
    await handleInstall();
  } else if (details.reason === 'update') {
    await handleUpdate(details.previousVersion);
  }
}

// Export for use in service worker
self.firstRunHandler = {
  onInstalledHandler,
  versionCompare,
  loadJSON
};

console.log('[CP Toolkit] First-run module loaded');
