// CivicPlus Toolkit - Context Menus for On-Demand Tools (MV3)
// Handles creation and execution of context menu items for on-demand scripts
// Version 2.3.1 - PHASE 3 FIX: Force recreate on install/reload

console.log('[CP Toolkit] Loading context-menus module...');

// PHASE 2: Store in chrome.storage.local to survive service worker restarts
const STORAGE_KEY = 'cp-toolkit-tools-registry';

// PHASE 3: Track initialization by version to prevent duplicate menu creation
const MENUS_VERSION_KEY = 'cp-toolkit-menus-version';
const CURRENT_VERSION = '2.17.0'; // Must match manifest.json

// In-memory cache for performance (will be repopulated from storage if needed)
let loadedTools = {};

/**
 * Get tool metadata - checks memory cache first, then chrome.storage.local
 * This ensures tools work even after service worker restarts
 * 
 * @param {string} toolName - The name of the tool to retrieve
 * @returns {Promise<Object|null>} Tool metadata or null if not found
 */
async function getToolMetadata(toolName) {
  // Check memory cache first (fast path)
  if (loadedTools[toolName]) {
    return loadedTools[toolName];
  }
  
  // Memory cache miss - load from storage
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const registry = result[STORAGE_KEY] || {};
    
    if (registry[toolName]) {
      // Repopulate memory cache for future calls
      loadedTools[toolName] = registry[toolName];
      console.log(`[CP Toolkit] Loaded "${toolName}" from storage (service worker restart recovery)`);
      return registry[toolName];
    }
    
    console.warn(`[CP Toolkit] Tool not found: "${toolName}"`);
    return null;
    
  } catch (err) {
    console.error(`[CP Toolkit] Storage error loading "${toolName}":`, err);
    return null;
  }
}


/**
 * Initialize all context menus and load tool definitions
 * PHASE 3: Version-tracked to prevent duplicate menu creation
 * 
 * @param {boolean} forceRecreate - If true, skip version check (use for onInstalled)
 */
async function initializeContextMenus(forceRecreate = false) {
  try {
    // PHASE 3: Check if menus already initialized for this version
    // BUT only if not forced (onInstalled always needs to recreate because Chrome clears menus)
    if (!forceRecreate) {
      const state = await chrome.storage.local.get(MENUS_VERSION_KEY);
      const storedVersion = state[MENUS_VERSION_KEY];
      
      if (storedVersion === CURRENT_VERSION) {
        console.log(`[CP Toolkit] Context menus already initialized for v${CURRENT_VERSION} (skipping)`);
        return;
      }
      
      // Version changed - will recreate
      if (storedVersion) {
        console.log(`[CP Toolkit] Menu version changed (${storedVersion} → ${CURRENT_VERSION}), reinitializing...`);
      }
    } else {
      console.log('[CP Toolkit] Extension installed/reloaded - recreating menus...');
    }
    
    // Clear any existing menus
    await chrome.contextMenus.removeAll();
    
    // Small delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 50));

    // Create the "About a tool" parent menu
    try {
      chrome.contextMenus.create({
        id: 'tool-about-menu',
        title: 'About a tool',
        contexts: ['all']
      });

      // Create "All Tools" help item
      chrome.contextMenus.create({
        id: 'tool-about-all',
        parentId: 'tool-about-menu',
        title: 'All Tools (tools you can run on this page appear below)',
        contexts: ['all']
      });
    } catch (menuErr) {
      console.error('[CP Toolkit] Failed to create base menu structure:', menuErr);
      return; // Abort if base menus fail
    }

    // Load tool definitions from JSON
    const toolDefinitionsUrl = chrome.runtime.getURL('data/on-demand-tools.json');
    const response = await fetch(toolDefinitionsUrl);

    if (!response.ok) {
      throw new Error(`Failed to load tools: ${response.status} ${response.statusText}`);
    }

    const toolDefinitions = await response.json();
    const toolNames = Object.keys(toolDefinitions);

    // Load disabled on-demand tools list
    const disabledResult = await chrome.storage.local.get('cp-toolkit-disabled-od-tools');
    const disabledTools = disabledResult['cp-toolkit-disabled-od-tools'] || {};

    // Build tool metadata array
    const tools = toolNames.map((toolName) => {
      const toolDef = toolDefinitions[toolName];

      return {
        name: toolName,
        file: toolDef.file,
        urlPatterns: toolDef.urlPatterns,
        help: toolDef.help,
        helpPages: toolDef.helpPages
      };
    });

    // Sort alphabetically
    tools.sort((a, b) => a.name.localeCompare(b.name));

    // Create context menu items for each tool
    tools.forEach(tool => {
      // Store metadata in memory cache (even if disabled, for help lookups)
      loadedTools[tool.name] = tool;

      // Skip disabled tools
      if (disabledTools[tool.name]) {
        console.log(`[CP Toolkit] Skipping disabled tool: "${tool.name}"`);
        return;
      }

      // Executable menu item
      try {
        chrome.contextMenus.create({
          id: tool.name,
          title: tool.name,
          contexts: ['all'],
          documentUrlPatterns: tool.urlPatterns
        });

        // Help menu item
        chrome.contextMenus.create({
          id: `${tool.name}-help`,
          parentId: 'tool-about-menu',
          title: tool.name,
          contexts: ['all'],
          documentUrlPatterns: tool.urlPatterns
        });
      } catch (toolMenuErr) {
        // Log but continue - individual tool menu failures shouldn't stop initialization
        console.warn(`[CP Toolkit] Failed to create menu for "${tool.name}":`, toolMenuErr.message);
      }
    });

    // PHASE 2: Save tool registry to chrome.storage.local for persistence
    await chrome.storage.local.set({ [STORAGE_KEY]: loadedTools });

    // PHASE 3: Mark this version as initialized to prevent duplicate menu creation
    await chrome.storage.local.set({ [MENUS_VERSION_KEY]: CURRENT_VERSION });

    console.log(`[CP Toolkit] ✓ Initialized ${tools.length} context menu tools`);

  } catch (err) {
    console.error('[CP Toolkit] ❌ FAILED to initialize context menus:', err);
    console.error('[CP Toolkit] Stack:', err.stack);
  }
}

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuItemId = info.menuItemId;

  // "All Tools" help
  if (menuItemId === 'tool-about-all') {
    chrome.tabs.create({
      openerTabId: tab.id,
      url: chrome.runtime.getURL('html/help.html#on-demand-tools')
    });
    return;
  }

  // Tool help
  if (menuItemId.endsWith('-help')) {
    const toolName = menuItemId.replace('-help', '');
    const tool = await getToolMetadata(toolName);

    if (tool) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (toolName, help, helpPages) => {
          alert(
            `Tool Name:\n${toolName}\n\n` +
            `Description:\n${help}\n\n` +
            `Will run on:\n${helpPages}`
          );
        },
        args: [toolName, tool.help, tool.helpPages]
      });
    } else {
      console.warn(`[CP Toolkit] Help unavailable for: "${toolName}"`);
    }
    return;
  }

  // Tool execution - CSP-COMPLIANT with PHASE 2 persistence
  const tool = await getToolMetadata(menuItemId);
  
  if (!tool) {
    console.error(`[CP Toolkit] Tool not found: "${menuItemId}"`);
    
    // Show helpful error message to user
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (toolName) => {
          alert(
            `CP Toolkit - Tool Not Found\n\n` +
            `The tool "${toolName}" could not be loaded.\n\n` +
            `This may happen if:\n` +
            `• The extension was just updated\n` +
            `• The service worker restarted\n\n` +
            `Try reloading the extension:\n` +
            `1. Open chrome://extensions\n` +
            `2. Click the refresh icon on CivicPlus Toolkit`
          );
        },
        args: [menuItemId]
      });
    } catch (alertErr) {
      console.error('[CP Toolkit] Could not show error alert:', alertErr);
    }
    
    return;
  }

  try {
    // Use external file injection (CSP-compliant)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [`js/tools/on-demand/${tool.file}`],
      world: 'MAIN'
    });
    
    console.log(`[CP Toolkit] ✓ Executed: "${menuItemId}"`);
    
  } catch (err) {
    console.error(`[CP Toolkit] Execution failed for "${menuItemId}":`, err);
    
    // Provide user feedback on error
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (toolName, errorMsg) => {
          console.error(`[CP Toolkit] Tool execution failed: ${toolName}`, errorMsg);
          alert(
            `CP Toolkit Error\n\n` +
            `Failed to execute: ${toolName}\n\n` +
            `Error: ${errorMsg}\n\n` +
            `Check the console for more details.`
          );
        },
        args: [menuItemId, err.message]
      });
    } catch (alertErr) {
      console.error('[CP Toolkit] Could not show error alert:', alertErr);
    }
  }
});

// Initialize on install / startup
// onInstalled: Always force recreate (Chrome clears menus on install/update/reload)
// onStartup: Use version check to avoid duplicates within same install
chrome.runtime.onInstalled.addListener(() => initializeContextMenus(true));  // Force recreate
chrome.runtime.onStartup.addListener(() => initializeContextMenus(false));   // Use version check

