// CivicPlus Toolkit - Help Page Script

// Check if this is a first run
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('firstrun') === 'true') {
  document.getElementById('first-run-message').style.display = 'block';
}

// Load and display on-load tools
fetch('../data/on-load-tools.json')
  .then(response => response.json())
  .then(tools => {
    const container = document.getElementById('on-load-tools-list');
    for (const [key, tool] of Object.entries(tools)) {
      const toolDiv = document.createElement('div');
      toolDiv.className = 'tool';
      toolDiv.id = key;
      
      const heading = document.createElement('h4');
      heading.textContent = tool.name;
      toolDiv.appendChild(heading);
      
      const description = document.createElement('div');
      description.textContent = tool['help-text'] || tool.description;
      toolDiv.appendChild(description);
      
      if (tool['settings-link']) {
        const linkDiv = document.createElement('div');
        linkDiv.style.marginTop = '5px';
        
        const link = document.createElement('a');
        link.href = tool['settings-link'].url;
        link.textContent = tool['settings-link'].text;
        
        linkDiv.appendChild(link);
        toolDiv.appendChild(linkDiv);
      }
      
      container.appendChild(toolDiv);
    }
  })
  .catch(err => console.error('Failed to load on-load tools:', err));

// Load and display on-demand tools
fetch('../data/on-demand-tools.json')
  .then(response => response.json())
  .then(tools => {
    const container = document.getElementById('on-demand-tools-list');
    for (const [toolName, tool] of Object.entries(tools)) {
      const toolDiv = document.createElement('div');
      toolDiv.className = 'tool';
      
      const heading = document.createElement('h4');
      heading.textContent = toolName;
      toolDiv.appendChild(heading);
      
      const description = document.createElement('div');
      description.textContent = tool.help || '';
      toolDiv.appendChild(description);
      
      if (tool.helpPages) {
        const pagesDiv = document.createElement('div');
        pagesDiv.style.marginTop = '5px';
        pagesDiv.style.fontSize = '12px';
        pagesDiv.style.color = '#666';
        pagesDiv.textContent = 'Available on: ' + tool.helpPages;
        toolDiv.appendChild(pagesDiv);
      }
      
      container.appendChild(toolDiv);
    }
  })
  .catch(err => console.error('Failed to load on-demand tools:', err));
