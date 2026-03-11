// CivicPlus Toolkit - Changelog Script

// Version comparison function
function versionCompare(v1, v2) {
  const v1parts = v1.split('.').map(Number);
  const v2parts = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
    const p1 = v1parts[i] || 0;
    const p2 = v2parts[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

// Parse URL parameter
const urlParams = new URLSearchParams(window.location.search);
const prevVersion = urlParams.get('prev') || '0.0.0';

// Get current extension version
const currentVersion = chrome.runtime.getManifest().version;

// Show message about what's new
const messageDiv = document.getElementById('message');
if (prevVersion !== '0.0.0') {
  const infoDiv = document.createElement('div');
  infoDiv.style.cssText = 'background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 15px; margin-bottom: 20px;';
  
  const infoPara = document.createElement('p');
  infoPara.style.cssText = 'color: #155724; margin: 0;';
  
  const icon = document.createElement('i');
  icon.className = 'fas fa-info-circle';
  
  infoPara.appendChild(icon);
  infoPara.appendChild(document.createTextNode(` Showing changes since version ${prevVersion}. New entries are highlighted below.`));
  infoDiv.appendChild(infoPara);
  messageDiv.appendChild(infoDiv);
}

// Load tools dynamically from JSON files
Promise.all([
  fetch('../data/on-load-tools.json').then(r => r.json()),
  fetch('../data/on-demand-tools.json').then(r => r.json())
]).then(([onLoadTools, onDemandTools]) => {
  // Populate on-load tools list
  const onLoadList = document.getElementById('on-load-tools-list');
  if (onLoadList) {
    for (const [key, tool] of Object.entries(onLoadTools)) {
      const li = document.createElement('li');
      li.textContent = tool.name;
      onLoadList.appendChild(li);
    }
  }
  
  // Populate on-demand tools list
  const onDemandList = document.getElementById('on-demand-tools-list');
  if (onDemandList) {
    for (const [toolName, tool] of Object.entries(onDemandTools)) {
      const li = document.createElement('li');
      li.textContent = toolName;
      onDemandList.appendChild(li);
    }
  }
}).catch(err => console.error('Failed to load tools:', err));

// Highlight versions newer than prevVersion
document.querySelectorAll('.version').forEach(versionDiv => {
  const versionMatch = versionDiv.className.match(/v([\d.]+)/);
  if (versionMatch) {
    const version = versionMatch[1];
    if (versionCompare(version, prevVersion) > 0) {
      versionDiv.style.backgroundColor = '#fffde7';
      versionDiv.style.borderLeft = '4px solid #ffc107';
      versionDiv.style.paddingLeft = '10px';
      versionDiv.style.marginLeft = '-14px';
    }
  }
});

// Update lastViewedChangelog in storage
chrome.storage.local.set({ lastViewedChangelog: currentVersion });
