// CSS Snippets Page — view, edit, create snippets + view copied skins
(function() {
  'use strict';

  var USER_SNIPPETS_KEY = 'cp-toolkit-user-snippets';

  var CATEGORIES = [
    { key: 'Buttons',   label: 'Buttons' },
    { key: 'News',      label: 'News' },
    { key: 'Slideshow', label: 'Slideshow' },
    { key: 'Mega Menu', label: 'Mega Menu' },
    { key: 'Nav Items', label: 'Nav Items' },
    { key: 'Footer',    label: 'Footer' },
    { key: 'Links',     label: 'Links' },
    { key: 'Calendar',  label: 'Calendar' },
    { key: 'Socials',   label: 'Socials' },
    { key: 'Headers',   label: 'Headers' },
    { key: 'Custom',    label: 'Custom' }
  ];

  var CATEGORY_ICONS = {
    'buttons':   '<path d="M21 3H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"></path><line x1="9" y1="7" x2="15" y2="7"></line>',
    'news':      '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path><line x1="10" y1="6" x2="18" y2="6"></line><line x1="10" y1="10" x2="18" y2="10"></line><line x1="10" y1="14" x2="14" y2="14"></line>',
    'slideshow': '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line>',
    'mega menu': '<line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>',
    'nav items': '<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>',
    'footer':    '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="15" x2="21" y2="15"></line>',
    'links':     '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>',
    'calendar':  '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
    'socials':   '<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>',
    'headers':   '<polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line>',
    'custom':    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>'
  };

  var chevronSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 12 15 18 9"></polyline></svg>';

  // State
  var allSnippets = {};
  var currentView = 'grid'; // 'grid' or 'list'
  var groupByCategory = false;

  function getCategoryIcon(cat) {
    var key = (cat || '').toLowerCase();
    var svg = CATEGORY_ICONS[key] || '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + svg + '</svg>';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(function() {
      var orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(function() {
        btn.textContent = orig;
        btn.classList.remove('copied');
      }, 1500);
    });
  }

  function generateSnippetKey(name) {
    var slug = (name || 'snippet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return slug + '-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
  }

  // ==================== STORAGE ====================

  function saveSnippets(callback) {
    chrome.storage.local.set({ [USER_SNIPPETS_KEY]: allSnippets }, callback);
  }

  // ==================== SNIPPET CARD ====================

  function buildSnippetCard(key, snippet) {
    var card = document.createElement('div');
    card.className = 'snippet-card';
    card.setAttribute('data-key', key);

    var badges = '';
    if (snippet.dynamicSelector) {
      badges += '<span class="dynamic-badge">Dynamic</span>';
    }
    if (snippet.components && Object.keys(snippet.components).length > 0) {
      badges += '<span class="multi-badge">Multi-Component</span>';
    }
    // Show category pill in grid/flat views
    if (snippet.category && !groupByCategory) {
      badges += '<span class="category-pill">' + escapeHtml(snippet.category) + '</span>';
    }

    var header = document.createElement('div');
    header.className = 'snippet-card-header';
    header.innerHTML =
      '<div class="snippet-card-title">' +
        escapeHtml(snippet.name || key) + badges +
      '</div>' +
      '<div class="snippet-card-actions">' +
        '<button class="btn-edit" title="Edit">Edit</button>' +
        '<button class="btn-delete" title="Delete">Delete</button>' +
      '</div>' +
      '<span class="snippet-card-chevron">' + chevronSVG + '</span>';

    // Toggle expand (only in list view)
    header.addEventListener('click', function(e) {
      if (e.target.closest('.snippet-card-actions')) return;
      card.classList.toggle('expanded');
    });

    // Edit button
    header.querySelector('.btn-edit').addEventListener('click', function(e) {
      e.stopPropagation();
      openModal(key, snippet);
    });

    // Delete button
    header.querySelector('.btn-delete').addEventListener('click', function(e) {
      e.stopPropagation();
      if (confirm('Delete "' + (snippet.name || key) + '"?')) {
        delete allSnippets[key];
        saveSnippets(function() { renderSnippets(); });
      }
    });

    card.appendChild(header);

    // Body
    var body = document.createElement('div');
    body.className = 'snippet-card-body';

    // Meta
    if (snippet.category || snippet.description) {
      var meta = document.createElement('div');
      meta.className = 'snippet-card-meta';
      if (snippet.category) {
        meta.innerHTML += '<span>' + getCategoryIcon(snippet.category) + ' ' + escapeHtml(snippet.category) + '</span>';
      }
      if (snippet.description) {
        meta.innerHTML += '<span>' + escapeHtml(snippet.description) + '</span>';
      }
      body.appendChild(meta);
    }

    // Code
    if (snippet.components && Object.keys(snippet.components).length > 0) {
      var compIds = Object.keys(snippet.components);
      var tabBar = document.createElement('div');
      tabBar.className = 'component-tab-bar';
      var codeContainer = document.createElement('div');

      compIds.forEach(function(compId, idx) {
        var tab = document.createElement('button');
        tab.className = 'component-tab' + (idx === 0 ? ' active' : '');
        tab.textContent = snippet.components[compId].label || 'Component ' + compId;
        tab.addEventListener('click', function(e) {
          e.stopPropagation();
          tabBar.querySelectorAll('.component-tab').forEach(function(t) { t.classList.remove('active'); });
          tab.classList.add('active');
          codeContainer.querySelectorAll('.code-block').forEach(function(b, i) {
            b.style.display = i === idx ? 'block' : 'none';
          });
        });
        tabBar.appendChild(tab);
      });

      body.appendChild(tabBar);

      compIds.forEach(function(compId, idx) {
        var code = snippet.components[compId].code || '';
        codeContainer.appendChild(createCodeBlock(code, idx !== 0));
      });

      body.appendChild(codeContainer);
    } else if (snippet.code) {
      body.appendChild(createCodeBlock(snippet.code, false));
    }

    card.appendChild(body);
    return card;
  }

  function createCodeBlock(code, hidden) {
    var block = document.createElement('div');
    block.className = 'code-block';
    if (hidden) block.style.display = 'none';

    var pre = document.createElement('pre');
    pre.textContent = code;

    var copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      copyToClipboard(code, copyBtn);
    });

    block.appendChild(pre);
    block.appendChild(copyBtn);
    return block;
  }

  // ==================== RENDER ====================

  function renderSnippets() {
    var grid = document.getElementById('snippets-grid');
    var emptyState = document.getElementById('snippets-empty');
    grid.innerHTML = '';

    var entries = Object.entries(allSnippets);
    if (entries.length === 0) {
      emptyState.style.display = 'block';
      grid.className = '';
      return;
    }
    emptyState.style.display = 'none';

    if (groupByCategory) {
      renderCategoryView(grid, entries);
    } else if (currentView === 'grid') {
      grid.className = 'view-grid';
      entries.forEach(function(entry) {
        grid.appendChild(buildSnippetCard(entry[0], entry[1]));
      });
    } else {
      grid.className = '';
      entries.forEach(function(entry) {
        grid.appendChild(buildSnippetCard(entry[0], entry[1]));
      });
    }
  }

  function renderCategoryView(grid, entries) {
    grid.className = currentView === 'grid' ? 'view-grid' : '';

    var grouped = {};
    var uncategorized = [];

    entries.forEach(function(entry) {
      var cat = entry[1].category || '';
      if (cat) {
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(entry);
      } else {
        uncategorized.push(entry);
      }
    });

    var renderCategory = function(label, icon, items) {
      var section = document.createElement('div');
      section.className = 'category-section';

      var header = document.createElement('div');
      header.className = 'category-header';
      header.innerHTML =
        '<span class="category-icon">' + icon + '</span>' +
        '<span class="category-name">' + escapeHtml(label) + '</span>' +
        '<span class="category-count">' + items.length + '</span>';
      section.appendChild(header);

      if (currentView === 'grid') {
        var wrap = document.createElement('div');
        wrap.className = 'snippet-cards-wrap';
        items.forEach(function(entry) { wrap.appendChild(buildSnippetCard(entry[0], entry[1])); });
        section.appendChild(wrap);
      } else {
        items.forEach(function(entry) { section.appendChild(buildSnippetCard(entry[0], entry[1])); });
      }

      grid.appendChild(section);
    };

    CATEGORIES.forEach(function(cat) {
      var items = grouped[cat.key];
      if (!items || items.length === 0) return;
      renderCategory(cat.label, getCategoryIcon(cat.key), items);
      delete grouped[cat.key];
    });

    Object.keys(grouped).forEach(function(cat) {
      renderCategory(cat, getCategoryIcon(cat), grouped[cat]);
    });

    if (uncategorized.length > 0) {
      renderCategory('Uncategorized', getCategoryIcon(''), uncategorized);
    }
  }

  // ==================== MODAL ====================

  function openModal(key, snippet) {
    var overlay = document.getElementById('snippet-modal-overlay');
    var title = document.getElementById('snippet-modal-title');
    var nameInput = document.getElementById('snippet-name');
    var categorySelect = document.getElementById('snippet-category');
    var codeTextarea = document.getElementById('snippet-code');
    var dynamicCheck = document.getElementById('snippet-dynamic');
    var quicklistCheck = document.getElementById('snippet-quicklist');
    var deleteBtn = document.getElementById('snippet-modal-delete');
    var saveBtn = document.getElementById('snippet-modal-save');

    var isEdit = !!key;

    title.textContent = isEdit ? 'Edit Snippet' : 'New Snippet';
    deleteBtn.style.display = isEdit ? '' : 'none';

    if (isEdit && snippet) {
      nameInput.value = snippet.name || '';
      categorySelect.value = snippet.category || '';
      codeTextarea.value = snippet.code || '';
      dynamicCheck.checked = !!snippet.dynamicSelector;
      quicklistCheck.checked = !!snippet.alwaysInQuickList;
    } else {
      nameInput.value = '';
      categorySelect.value = '';
      codeTextarea.value = '';
      dynamicCheck.checked = false;
      quicklistCheck.checked = false;
    }

    overlay.style.display = 'flex';
    setTimeout(function() { nameInput.focus(); }, 50);

    // Clean up old handlers by cloning buttons
    var newSave = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSave, saveBtn);
    var newDelete = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDelete, deleteBtn);

    // Save
    newSave.addEventListener('click', function() {
      var name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }

      var snippetData = {
        name: name,
        category: categorySelect.value || undefined,
        code: codeTextarea.value,
        dynamicSelector: dynamicCheck.checked || undefined,
        alwaysInQuickList: quicklistCheck.checked || undefined,
        isUserSnippet: true
      };

      // Preserve existing multi-component data if editing
      if (isEdit && snippet && snippet.components) {
        snippetData.components = snippet.components;
      }

      var saveKey = isEdit ? key : generateSnippetKey(name);
      allSnippets[saveKey] = snippetData;

      saveSnippets(function() {
        overlay.style.display = 'none';
        renderSnippets();
      });
    });

    // Delete
    newDelete.addEventListener('click', function() {
      if (confirm('Delete "' + (snippet.name || key) + '"?')) {
        delete allSnippets[key];
        saveSnippets(function() {
          overlay.style.display = 'none';
          renderSnippets();
        });
      }
    });
  }

  function closeModal() {
    document.getElementById('snippet-modal-overlay').style.display = 'none';
  }

  // ==================== TABS ====================

  function initTabs() {
    document.querySelectorAll('.tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(function(tc) { tc.classList.remove('active'); });
        document.getElementById('tab-' + tab.getAttribute('data-tab')).classList.add('active');
      });
    });
  }

  // ==================== TOOLBAR ====================

  function initToolbar() {
    // View toggle
    document.querySelectorAll('.view-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.view-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentView = btn.getAttribute('data-view');
        renderSnippets();
      });
    });

    // Category toggle
    var catBtn = document.getElementById('btn-sort-category');
    catBtn.addEventListener('click', function() {
      groupByCategory = !groupByCategory;
      catBtn.classList.toggle('active', groupByCategory);
      renderSnippets();
    });

    // New snippet
    document.getElementById('btn-new-snippet').addEventListener('click', function() {
      openModal(null, null);
    });
  }

  // ==================== INIT ====================

  function init() {
    initTabs();
    initToolbar();

    // Modal close handlers
    document.getElementById('snippet-modal-close').addEventListener('click', closeModal);
    document.getElementById('snippet-modal-cancel').addEventListener('click', closeModal);
    document.getElementById('snippet-modal-overlay').addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });

    // Load data
    chrome.storage.local.get(USER_SNIPPETS_KEY, function(result) {
      allSnippets = result[USER_SNIPPETS_KEY] || {};
      renderSnippets();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
