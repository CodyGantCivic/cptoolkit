// Popup JavaScript

let toolsData = {};
const GITHUB_REPO = 'cp-vlasak/cptoolkit';
const DOWNLOAD_PAGE = 'https://cp-vlasak.github.io/cptoolkit/';

// Tool categories - same as options.js
const categories = {
  "CSS & Design Tools": [
    "mini-ide",
    "custom-css-deployer",
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
      updateDiv.innerHTML = '<i class="fas fa-arrow-circle-up"></i> Update available: v' + latestTag + ' (you have v' + currentVersion + '). Click to download.';
      updateDiv.style.display = '';
      updateDiv.addEventListener('click', () => {
        chrome.tabs.create({ url: DOWNLOAD_PAGE });
      });
    }
  } catch (e) {
    // Silently ignore — network errors, rate limits, etc.
  }
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
    const hostname = url.hostname;
    
    // Check for special URLs that can't be CivicPlus sites
    if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || 
        url.protocol === 'about:' || url.protocol === 'edge:') {
      statusDiv.textContent = 'Browser page - Not a CivicPlus site';
      statusDiv.className = 'status inactive';
      return;
    }
    
    // Try to detect if it's a CivicPlus site by checking for the test file
    statusDiv.textContent = 'Checking site...';
    statusDiv.className = 'status inactive';
    
    // Use scripting API to run detection in the page context
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Check if CivicPlus detection already ran and cached result
          if (typeof _cpSiteDetected !== 'undefined' && _cpSiteDetected !== null) {
            return _cpSiteDetected;
          }
          // Otherwise return null to indicate we need to check
          return null;
        }
      });
      
      const cachedResult = results[0]?.result;
      
      if (cachedResult === true) {
        statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> CivicPlus Site: ' + hostname;
        statusDiv.className = 'status active';
        return;
      } else if (cachedResult === false) {
        statusDiv.innerHTML = '<i class="fas fa-times-circle"></i> Not a CivicPlus site';
        statusDiv.className = 'status inactive';
        return;
      }
      
      // If no cached result, inject a script to check
      const checkResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          return new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('HEAD', '/Assets/Mystique/Shared/Components/ModuleTiles/Templates/cp-Module-Tile.html');
            xhr.timeout = 3000;
            xhr.onload = () => resolve(xhr.status === 200);
            xhr.onerror = () => resolve(false);
            xhr.ontimeout = () => resolve(false);
            xhr.send();
          });
        }
      });
      
      const isCPSite = checkResults[0]?.result;
      
      if (isCPSite) {
        statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> CivicPlus Site: ' + hostname;
        statusDiv.className = 'status active';
      } else {
        statusDiv.innerHTML = '<i class="fas fa-times-circle"></i> Not a CivicPlus site';
        statusDiv.className = 'status inactive';
      }
      
    } catch (scriptError) {
      // Can't inject script (restricted page)
      statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Cannot check this page';
      statusDiv.className = 'status inactive';
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
    
    // Generate the UI
    generateToolsUI(settings);
  } catch (error) {
    console.error('Failed to load tools configuration:', error);
    document.getElementById('tools-container').innerHTML = '<p style="color: red; font-size: 12px;">Error loading tools.</p>';
  }
}

// Generate the tools UI dynamically
function generateToolsUI(settings) {
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
