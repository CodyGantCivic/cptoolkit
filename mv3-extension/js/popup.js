// Popup JavaScript

let toolsData = {};
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
    "css-snippets",
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

const VANITY_DISMISSED_KEY = 'cp-toolkit-vanity-dismissed-hosts';
const VANITY_POPUP_CONTEXT_KEY = 'cp-toolkit-vanity-popup-context';
const VANITY_ADMIN_PATH = /^\/(?:admin|designcenter)(?:\/|$)/i;

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

      // On admin / Design Center URLs wait for the Admin lane, not just the
      // first lane found: Live Edit markers can appear before Admin evidence
      // and would leave the approved site with only the Live Edit tool set.
      const location = (CPToolkitDomDetector.evaluatePage().location) || {};
      const expectsAdmin = !!(location.isAdminPath || location.isDesignCenterPath);
      const result = await CPToolkitDomDetector.waitForDetection({
        targetLanes: expectsAdmin ? ['admin', 'identity'] : ['admin', 'live-edit', 'identity'],
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

async function ensureTrustedOriginRegistration(originPattern) {
  const registerResponse = await chrome.runtime.sendMessage({
    action: 'cp-toolkit-register-trusted-origin',
    originPattern: originPattern
  });
  const registerResult = registerResponse && registerResponse.result;
  if (!registerResult || registerResult.registered !== true) {
    throw new Error(registerResult && registerResult.skipped ? registerResult.skipped : 'Origin registration failed');
  }

  return registerResult;
}

async function prepareTrustedOriginActivation(tab, originPattern, lanes) {
  const response = await chrome.runtime.sendMessage({
    action: 'cp-toolkit-prepare-trusted-origin',
    originPattern: originPattern,
    tabId: tab.id,
    lanes: lanes
  });
  const result = response && response.result;
  if (!result || result.prepared !== true) {
    throw new Error(result && result.skipped ? result.skipped : 'Could not prepare domain trust');
  }
  return result;
}

async function clearPendingTrustedOrigin(tab, originPattern) {
  try {
    await chrome.runtime.sendMessage({
      action: 'cp-toolkit-clear-pending-trusted-origin',
      originPattern: originPattern,
      tabId: tab.id
    });
  } catch (error) {
    // The record is short-lived and will expire automatically if the popup is
    // destroyed before cleanup can complete.
  }
}

function setTrustedInactiveStatus(statusDiv, tab) {
  setSiteStatus(
    statusDiv,
    'inactive',
    'fas fa-check-circle',
    'Trusted CivicPlus domain: ' + normalizeHostname(new URL(tab.url).hostname) + ' (no editor on this page)'
  );
}

async function registerAndActivateTrustedOrigin(statusDiv, tab, originPattern, lanes) {
  await ensureTrustedOriginRegistration(originPattern);

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
  statusDiv.appendChild(document.createTextNode(
    lanes.includes('live-edit')
      ? ' CivicPlus editor detected on this domain.'
      : ' CivicPlus admin detected on this domain.'
  ));

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Trust this domain';
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Requesting access...';
    let pendingTrustPrepared = false;

    try {
      await prepareTrustedOriginActivation(tab, originPattern, lanes);
      pendingTrustPrepared = true;

      const granted = await chrome.permissions.request({ origins: [originPattern] });
      if (!granted) {
        await clearPendingTrustedOrigin(tab, originPattern);
        setSiteStatus(statusDiv, 'inactive', 'fas fa-times-circle', 'Domain was not trusted');
        return;
      }

      button.textContent = 'Activating...';
      await registerAndActivateTrustedOrigin(statusDiv, tab, originPattern, lanes);
    } catch (error) {
      if (pendingTrustPrepared) {
        await clearPendingTrustedOrigin(tab, originPattern);
      }
      setSiteStatus(statusDiv, 'inactive', 'fas fa-exclamation-circle', error.message || 'Could not trust this domain');
    }
  });

  statusDiv.appendChild(button);

  const host = normalizeHostname(new URL(tab.url).hostname);
  // Closing the popup is "not now": the automatic popup only opens once per
  // browser session for each site. Clicking the toolbar icon on the site
  // always shows this prompt again.
  const neverButton = document.createElement('button');
  neverButton.type = 'button';
  neverButton.textContent = "Don't ask again for this site";
  neverButton.style.cssText = [
    'display:block', 'width:auto', 'height:auto', 'margin:8px auto 0', 'padding:0',
    'background:none!important', 'border:none!important', 'box-shadow:none!important',
    'color:#5f6b7a!important', 'font-size:11px', 'font-weight:normal',
    'text-decoration:underline', 'cursor:pointer'
  ].join(';');
  neverButton.addEventListener('click', async () => {
    await addHostToList(chrome.storage.local, VANITY_DISMISSED_KEY, host);
    window.close();
  });

  statusDiv.appendChild(neverButton);
}

async function getAutoOpenedTabUrl(tabId) {
  try {
    const storage = chrome.storage.session || chrome.storage.local;
    const settings = await storage.get(VANITY_POPUP_CONTEXT_KEY);
    const context = settings[VANITY_POPUP_CONTEXT_KEY];
    if (
      context &&
      context.tabId === tabId &&
      typeof context.url === 'string' &&
      Date.now() - Number(context.createdAt || 0) < 120000
    ) {
      return context.url;
    }
  } catch (error) {
    // Fall through to the normal "No active tab" state.
  }
  return '';
}

async function addHostToList(storage, key, host) {
  try {
    const settings = await storage.get(key);
    const list = Array.isArray(settings[key]) ? settings[key] : [];
    if (!list.includes(host)) list.push(host);
    await storage.set({ [key]: list });
  } catch (error) {
    // Dismissal is a convenience; the popup still closes if storage fails.
  }
}

async function isHostInList(storage, key, host) {
  try {
    const settings = await storage.get(key);
    return Array.isArray(settings[key]) && settings[key].includes(host);
  } catch (error) {
    return false;
  }
}

// An automatically opened popup has no page access, so detection can't run.
// For an unapproved site the URL is the only signal: show the approval prompt
// for CivicPlus admin / Design Center paths unless the user said no already.
async function renderUrlBasedTrustPrompt(statusDiv, tab, originPattern) {
  const url = new URL(tab.url);
  const host = normalizeHostname(url.hostname);
  if (!VANITY_ADMIN_PATH.test(url.pathname)) return false;
  if (await isHostInList(chrome.storage.local, VANITY_DISMISSED_KEY, host)) return false;

  await renderVanityTrustPrompt(statusDiv, tab, { lanes: ['admin'] }, originPattern);
  return true;
}

// Check if current tab is a CivicPlus site
async function checkCivicPlusSite() {
  const statusDiv = document.getElementById('site-status');
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // A popup opened automatically (not by a click) has no activeTab grant, so
  // Chrome hides the tab's URL. The service worker saw the navigation and left
  // the URL for us.
  if (tab && !tab.url) {
    const knownUrl = await getAutoOpenedTabUrl(tab.id);
    if (knownUrl) tab = Object.assign({}, tab, { url: knownUrl });
  }

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
      if (!originPattern) {
        setSiteStatus(statusDiv, 'inactive', 'fas fa-times-circle', 'Not a CivicPlus site');
        return;
      }

      statusDiv.textContent = 'Checking site...';
      statusDiv.className = 'status inactive';

      const hasTrustedOriginPermission = await chrome.permissions.contains({ origins: [originPattern] });

      try {
        if (hasTrustedOriginPermission) {
          await ensureTrustedOriginRegistration(originPattern);
        }

        const detection = await detectCurrentTabWithDomDetector(tab.id);
        if (detection && detection.detected) {
          await renderVanityTrustPrompt(statusDiv, tab, detection, originPattern);
        } else if (hasTrustedOriginPermission) {
          setTrustedInactiveStatus(statusDiv, tab);
        } else {
          setSiteStatus(statusDiv, 'inactive', 'fas fa-times-circle', 'Not a CivicPlus site');
        }
      } catch (scriptError) {
        if (hasTrustedOriginPermission) {
          setTrustedInactiveStatus(statusDiv, tab);
        } else if (!(await renderUrlBasedTrustPrompt(statusDiv, tab, originPattern))) {
          setSiteStatus(statusDiv, 'inactive', 'fas fa-times-circle', 'Not a CivicPlus site');
        }
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

  if (toolId === 'css-snippets') {
    const sidebarBtn = toolDiv.querySelector('.tool-snippets-btn');
    if (sidebarBtn) {
      sidebarBtn.disabled = !newState;
      sidebarBtn.title = newState ? 'Open CSS Snippets Sidebar' : 'Enable CSS Snippets first';
    }
  }

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

      // Add the Snippets sidebar icon button next to its own CSS Snippets toggle
      if (toolId === 'css-snippets') {
        const snippetsBtn = document.createElement('button');
        snippetsBtn.className = 'tool-snippets-btn';
        snippetsBtn.disabled = !isEnabled;
        snippetsBtn.title = isEnabled ? 'Open CSS Snippets Sidebar' : 'Enable CSS Snippets first';
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
  loadToolsAndSettings();
});
