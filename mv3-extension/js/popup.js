// Popup JavaScript

let toolsData = {};
const GITHUB_REPO = 'cp-vlasak/cptoolkit';
const DOWNLOAD_PAGE = 'https://cp-vlasak.github.io/cptoolkit/';
const KNOWN_PLATFORM_SUFFIXES = [
  '.civicplus.com',
  '.civic.place',
  '.civicplus.pro',
  '.cpqa.ninja'
];
const KNOWN_PLATFORM_HOSTS = [
  'civicplus.com',
  'civic.place',
  'civicplus.pro',
  'cpqa.ninja',
  'account.civicplus.com',
  'identityserver.cpqa.ninja'
];

// Tool categories - same as options.js
const categories = {
  "CSS & Design Tools": [
    "mini-ide",
    "custom-css-deployer",
    "option-set-importer",
    "widget-skin-advanced-style-helper",
    "graphic-link-advanced-style-helper",
    "widget-skin-default-override",
    "theme-manager-enhancer",
    "theme-manager-skin-organizer",
    "redesign-manager-skin-sorter",
    "enforce-advanced-styles-text-limits",
    "fix-copied-skin-references"
  ],
  "Quick Links & Graphic Links": [
    "cp-MultipleQuickLinks",
    "quick-link-autofill",
    "graphic-link-autofill",
    "cp-ImportFancyButton",
  ],
  "Layout & Content Tools": [
    "download-xml-css",
    "layout-manager-sorter",
    "xml-change-alerts",
    "cp-MultipleCategoryUpload",
    "cp-MultipleInfoAdvancedItems",
    "cp-InfoAdvancedImportExport",
  ],
  "UI Enhancements": [
    "title-changer",
    "keyboard-shortcuts",
    "module-icons",
    "input-focus",
    "auto-dismiss-help-welcome",
  ],
  "Session & Status": ["prevent-timeout"],
  "Other Tools": ["remember-image-picker-state", "show-changelog"],
};

// Check for extension updates via GitHub Releases API
function compareSemver(a, b) {
  const pa = String(a || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const max = Math.max(pa.length, pb.length);
  for (let i = 0; i < max; i++) {
    const av = pa[i] || 0;
    const bv = pb[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

async function checkForUpdate() {
  const updateDiv = document.getElementById('update-status');
  try {
    const currentVersion = chrome.runtime.getManifest().version;
    const resp = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/releases/latest');
    if (!resp.ok) return;
    const release = await resp.json();
    const latestTag = (release.tag_name || '').replace(/^v/, '');
    if (latestTag && compareSemver(latestTag, currentVersion) === 1) {
      updateDiv.textContent = '';
      const icon = document.createElement('i');
      icon.className = 'fas fa-arrow-circle-up';
      updateDiv.appendChild(icon);
      updateDiv.appendChild(document.createTextNode(' Update available: v' + latestTag + ' (you have v' + currentVersion + '). Click to download.'));
      updateDiv.style.display = '';
      updateDiv.addEventListener('click', () => {
        chrome.tabs.create({ url: DOWNLOAD_PAGE });
      });
    }
  } catch (e) {
    // Silently ignore — network errors, rate limits, etc.
  }
}

function normalizeHostname(hostname) {
  return String(hostname || '').toLowerCase().replace(/\.$/, '');
}

function isKnownPlatformHost(hostname) {
  const host = normalizeHostname(hostname);
  if (!host) return false;
  if (KNOWN_PLATFORM_HOSTS.includes(host)) return true;
  return KNOWN_PLATFORM_SUFFIXES.some(suffix => host.endsWith(suffix));
}

function getHttpsOriginPattern(urlString) {
  try {
    const url = new URL(urlString);
    const hostname = normalizeHostname(url.hostname);
    if (url.protocol !== 'https:' || !hostname || hostname.includes('*')) return null;
    return 'https://' + hostname + '/*';
  } catch (e) {
    return null;
  }
}

function isVanityAdminCandidate(url) {
  const pathname = String(url.pathname || '');
  return /^\/(?:admin|designcenter)(?:\/|$)/i.test(pathname);
}

function getActivatingLanes(lanes) {
  if (!Array.isArray(lanes)) return [];
  return lanes.filter(lane => lane === 'admin' || lane === 'live-edit' || lane === 'identity');
}

function setSiteStatus(statusDiv, className, iconClass, text) {
  statusDiv.textContent = '';
  statusDiv.className = 'status ' + className;

  const icon = document.createElement('i');
  icon.className = iconClass;
  statusDiv.appendChild(icon);
  statusDiv.appendChild(document.createTextNode(' ' + text));
}

async function detectCurrentTabWithDomDetector(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['js/content/cp-dom-detector.js']
  });

  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: async () => {
      if (
        typeof CPToolkitDomDetector === 'undefined' ||
        !CPToolkitDomDetector ||
        typeof CPToolkitDomDetector.waitForDetection !== 'function'
      ) {
        return { detected: false, lanes: [] };
      }

      const result = await CPToolkitDomDetector.waitForDetection({
        targetLanes: ['admin', 'live-edit', 'identity'],
        timeoutMs: 1500
      });

      return {
        detected: !!(
          result &&
          Array.isArray(result.lanes) &&
          result.lanes.some(lane => lane === 'admin' || lane === 'live-edit' || lane === 'identity')
        ),
        lanes: result && Array.isArray(result.lanes) ? result.lanes : []
      };
    }
  });

  return results[0]?.result || { detected: false, lanes: [] };
}

async function registerAndActivateTrustedOrigin(statusDiv, tab, originPattern, lanes) {
  const registerResponse = await chrome.runtime.sendMessage({
    action: 'cp-toolkit-register-trusted-origin',
    originPattern: originPattern
  });
  const registerResult = registerResponse && registerResponse.result;
  if (!registerResult || registerResult.registered !== true) {
    throw new Error(registerResult && registerResult.skipped ? registerResult.skipped : 'Origin registration failed');
  }

  const activateResponse = await chrome.runtime.sendMessage({
    action: 'cp-toolkit-activate-trusted-tab',
    tabId: tab.id,
    lanes: lanes
  });
  const activateResult = activateResponse && activateResponse.result;
  if (!activateResult || activateResult.activated !== true) {
    throw new Error(activateResult && activateResult.skipped ? activateResult.skipped : 'Current tab activation failed');
  }

  setSiteStatus(statusDiv, 'active', 'fas fa-check-circle', 'CivicPlus Site: ' + normalizeHostname(new URL(tab.url).hostname));
}

async function renderVanityTrustPrompt(statusDiv, tab, detection, originPattern) {
  const lanes = getActivatingLanes(detection && detection.lanes);
  if (lanes.length === 0) {
    setSiteStatus(statusDiv, 'inactive', 'fas fa-times-circle', 'Not a CivicPlus site');
    return;
  }

  const hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
  if (hasPermission) {
    await registerAndActivateTrustedOrigin(statusDiv, tab, originPattern, lanes);
    return;
  }

  statusDiv.textContent = '';
  statusDiv.className = 'status inactive';

  const icon = document.createElement('i');
  icon.className = 'fas fa-exclamation-circle';
  statusDiv.appendChild(icon);
  statusDiv.appendChild(document.createTextNode(' CivicPlus admin detected on this domain.'));

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Trust this domain';
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Requesting access...';

    try {
      const granted = await chrome.permissions.request({ origins: [originPattern] });
      if (!granted) {
        setSiteStatus(statusDiv, 'inactive', 'fas fa-times-circle', 'Domain was not trusted');
        return;
      }

      button.textContent = 'Activating...';
      await registerAndActivateTrustedOrigin(statusDiv, tab, originPattern, lanes);
    } catch (error) {
      setSiteStatus(statusDiv, 'inactive', 'fas fa-exclamation-circle', error.message || 'Could not trust this domain');
    }
  });

  statusDiv.appendChild(button);
}

// Check if current tab is a CivicPlus site
async function checkCivicPlusSite() {
  const statusDiv = document.getElementById('site-status');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.url) {
    statusDiv.textContent = 'No active tab';
    statusDiv.className = 'status inactive';
    return;
  }
  
  try {
    const url = new URL(tab.url);
    const hostname = normalizeHostname(url.hostname);
    
    // Check for special URLs that can't be CivicPlus sites
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      statusDiv.textContent = 'Browser page - Not a CivicPlus site';
      statusDiv.className = 'status inactive';
      return;
    }

    if (!isKnownPlatformHost(hostname)) {
      const originPattern = getHttpsOriginPattern(tab.url);
      if (!originPattern || !isVanityAdminCandidate(url)) {
        setSiteStatus(statusDiv, 'inactive', 'fas fa-times-circle', 'Not a CivicPlus site');
        return;
      }

      statusDiv.textContent = 'Checking site...';
      statusDiv.className = 'status inactive';

      try {
        const detection = await detectCurrentTabWithDomDetector(tab.id);
        if (detection && detection.detected) {
          await renderVanityTrustPrompt(statusDiv, tab, detection, originPattern);
        } else {
          setSiteStatus(statusDiv, 'inactive', 'fas fa-times-circle', 'Not a CivicPlus site');
        }
      } catch (scriptError) {
        setSiteStatus(statusDiv, 'inactive', 'fas fa-times-circle', 'Not a CivicPlus site');
      }
      return;
    }
    
    statusDiv.textContent = 'Checking site...';
    statusDiv.className = 'status inactive';
    
    // Use the detector/bootstrap cache when available. Do not probe arbitrary
    // sites here; SPA fallback 200s caused false positives.
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Check if CivicPlus detection already ran and cached result
          if (typeof _cpSiteDetected !== 'undefined' && _cpSiteDetected !== null) {
            return _cpSiteDetected;
          }
          if (
            typeof CPToolkitDomDetector !== 'undefined' &&
            CPToolkitDomDetector &&
            typeof CPToolkitDomDetector.evaluatePage === 'function'
          ) {
            const result = CPToolkitDomDetector.evaluatePage();
            return !!(result && Array.isArray(result.lanes) && result.lanes.length > 0);
          }
          return null;
        }
      });
      
      const cachedResult = results[0]?.result;
      
      if (cachedResult !== false) {
        setSiteStatus(statusDiv, 'active', 'fas fa-check-circle', 'CivicPlus Site: ' + hostname);
        return;
      }

      setSiteStatus(statusDiv, 'inactive', 'fas fa-times-circle', 'Not a CivicPlus site');
      
    } catch (scriptError) {
      // Can't inject script (restricted page)
      setSiteStatus(statusDiv, 'inactive', 'fas fa-exclamation-circle', 'Cannot check this page');
    }
    
  } catch (e) {
    statusDiv.textContent = 'Invalid URL';
    statusDiv.className = 'status inactive';
  }
}

function openCustomCssManager() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('html/custom-css-deployments.html')
  });
}

function isWidgetManagerUrl(url) {
  try {
    return /\/DesignCenter\/Widgets(?:\/|$)/i.test(new URL(url || '').pathname);
  } catch (e) {
    return false;
  }
}

// Toggle tool enabled/disabled state
async function toggleTool(toolId) {
  const settings = await chrome.storage.local.get(toolId);
  const tool = toolsData[toolId];
  const defaultEnabled = tool['enabled-by-default'] !== false;
  const currentState = settings[toolId] !== undefined ? settings[toolId] : defaultEnabled;
  const newState = !currentState;
  
  // Save new state
  await chrome.storage.local.set({ [toolId]: newState });
  
  // Update UI
  const toolDiv = document.getElementById('tool-' + toolId);
  const statusSpan = toolDiv.querySelector('.tool-status');
  
  if (newState) {
    toolDiv.classList.add('enabled');
    statusSpan.className = 'tool-status on';
    statusSpan.textContent = '✓';
  } else {
    toolDiv.classList.remove('enabled');
    statusSpan.className = 'tool-status off';
    statusSpan.textContent = '○';
  }
}

// Load tools data and generate UI
async function loadToolsAndSettings() {
  try {
    // Load the tools configuration
    const response = await fetch(chrome.runtime.getURL('data/on-load-tools.json'));
    toolsData = await response.json();
    
    // Load current settings
    const settings = await chrome.storage.local.get(null);
    
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Generate the UI
    generateToolsUI(settings, activeTab);
  } catch (error) {
    console.error('Failed to load tools configuration:', error);
    document.getElementById('tools-container').innerHTML = '<p style="color: red; font-size: 12px;">Error loading tools.</p>';
  }
}

// Generate the tools UI dynamically
function generateToolsUI(settings, activeTab) {
  const container = document.getElementById('tools-container');
  container.innerHTML = '';
  
  for (const [categoryName, toolIds] of Object.entries(categories)) {
    // Filter to only tools that exist in toolsData
    const existingTools = toolIds.filter(id => toolsData[id]);
    
    if (existingTools.length === 0) continue;
    
    const section = document.createElement('div');
    section.className = 'section';
    
    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = categoryName;
    section.appendChild(title);
    
    const toolsDiv = document.createElement('div');
    toolsDiv.className = 'tools';
    
    for (const toolId of existingTools) {
      const tool = toolsData[toolId];
      const defaultEnabled = tool['enabled-by-default'] !== false;
      const isEnabled = settings[toolId] !== undefined ? settings[toolId] : defaultEnabled;
      
      const toolDiv = document.createElement('div');
      toolDiv.className = 'tool' + (isEnabled ? ' enabled' : '');
      toolDiv.id = 'tool-' + toolId;
      toolDiv.dataset.toolId = toolId;
      toolDiv.title = 'Click to ' + (isEnabled ? 'disable' : 'enable');
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = tool.name;
      
      const statusSpan = document.createElement('span');
      statusSpan.className = 'tool-status ' + (isEnabled ? 'on' : 'off');
      statusSpan.textContent = isEnabled ? '✓' : '○';
      
      toolDiv.appendChild(nameSpan);

      // Add CSS Snippets icon button next to Mini IDE
      if (toolId === 'mini-ide') {
        const snippetsBtn = document.createElement('button');
        snippetsBtn.className = 'tool-snippets-btn';
        snippetsBtn.title = 'Open CSS Snippets Sidebar';
        snippetsBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>';
        snippetsBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab || !tab.id) return;
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'openSnippetsSidebar' });
            window.close();
          } catch (err) {
            // Content scripts only run on CivicPlus sites — silently ignore on other pages
          }
        });
        toolDiv.appendChild(snippetsBtn);
      }

      if (toolId === 'custom-css-deployer') {
        const manageBtn = document.createElement('button');
        manageBtn.className = 'tool-snippets-btn';
        manageBtn.title = 'Open Custom CSS Deployment Manager';
        manageBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';
        manageBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openCustomCssManager();
          window.close();
        });
        toolDiv.appendChild(manageBtn);
      }

      if (toolId === 'option-set-importer') {
        const optionSetBtn = document.createElement('button');
        const canOpen = isEnabled && activeTab && activeTab.id && isWidgetManagerUrl(activeTab.url);
        optionSetBtn.className = 'tool-snippets-btn';
        optionSetBtn.title = canOpen
          ? 'Open Option Set Importer'
          : (isEnabled ? 'Open Widget Manager to use Option Set Importer' : 'Enable Option Set Importer first');
        optionSetBtn.disabled = !canOpen;
        optionSetBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"></path><path d="M4 12h10"></path><path d="M4 18h7"></path><path d="M18 15v6"></path><path d="M15 18h6"></path></svg>';
        optionSetBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!canOpen) return;
          try {
            await chrome.tabs.sendMessage(activeTab.id, { action: 'openOptionSetImporter' });
            window.close();
          } catch (err) {
            // Content scripts only run on CivicPlus sites and enabled tools.
          }
        });
        toolDiv.appendChild(optionSetBtn);
      }

      toolDiv.appendChild(statusSpan);

      // Add click handler to toggle
      toolDiv.addEventListener('click', () => toggleTool(toolId));

      toolsDiv.appendChild(toolDiv);
    }
    
    section.appendChild(toolsDiv);
    container.appendChild(section);
  }
}

// Open options page
document.getElementById('open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkCivicPlusSite();
  checkForUpdate();
  loadToolsAndSettings();
});
