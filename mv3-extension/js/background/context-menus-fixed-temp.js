// CivicPlus Toolkit - Context Menus for On-Demand Tools (MV3)
// Handles creation and execution of context menu items for on-demand scripts
// Version 2.3.1 - PHASE 3: Duplicate Menu Cleanup + Debug Logging

// PHASE 2: Store in chrome.storage.local to survive service worker restarts
const STORAGE_KEY = 'cp-toolkit-tools-registry';

// PHASE 3: Track initialization by version to prevent duplicate menu creation
const MENUS_VERSION_KEY = 'cp-toolkit-menus-version';
const CURRENT_VERSION = '2.16.0'; // Must match manifest.json

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
      return registry[toolName];
    }
    
    console.warn(`[CP Toolkit] Tool "${toolName}" not found in memory or storage`);
    return null;
    
  } catch (err) {
    console.error(`[CP Toolkit] Failed to load tool from storage:`, err);
    return null;
  }
}

