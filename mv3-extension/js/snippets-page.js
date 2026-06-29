// CSS Snippets Page — view, edit, create snippets + view copied skins
(function() {
  'use strict';

  var USER_SNIPPETS_KEY = 'cp-toolkit-user-snippets';
  var COPIED_SKINS_KEY = 'cp-toolkit-copied-skins';
  var libraryStore = window.CPToolkitSnippetLibraryStore || (window.CPToolkit && window.CPToolkit.snippetLibraryStore) || null;
  var libraryView = window.CPToolkitSnippetLibraryView || (window.CPToolkit && window.CPToolkit.snippetLibraryView) || null;

  var CATEGORIES = [
    { key: 'Buttons',   label: 'Buttons',   description: 'Shows in Fancy Button Builder' },
    { key: 'News',      label: 'News',      description: 'Skins with "news" or "carousel" in name' },
    { key: 'Slideshow', label: 'Slideshow', description: 'Skins with "slideshow" in name' },
    { key: 'Mega Menu', label: 'Mega Menu', description: 'Skins with "mega menu" in name' },
    { key: 'Nav Items', label: 'Nav Items', description: 'Navigation menu style editor' },
    { key: 'Footer',    label: 'Footer',    description: 'Skins with "footer" in name' },
    { key: 'Links',     label: 'Links',     description: 'Skins with "link", "links", or "popular resources" in name' },
    { key: 'Calendar',  label: 'Calendar',  description: 'Skins with "calendar" in name or calendar component' },
    { key: 'Socials',   label: 'Socials',   description: 'Skins with "social media" or "socials" in name' },
    { key: 'Headers',   label: 'Headers',   description: 'Skins with "header" or "headers" in name' },
    { key: 'Custom',    label: 'Custom',    description: 'Custom category' }
  ];

  var SKIN_COMPONENT_TYPES = [
    { id: 0, name: 'Wrapper', description: 'Outer container styles' },
    { id: 1, name: 'Header', description: 'Widget header styles' },
    { id: 2, name: 'Item List', description: 'Container for all items' },
    { id: 3, name: 'Item', description: 'Individual item styles' },
    { id: 4, name: 'Item Title', description: 'Title text within items' },
    { id: 5, name: 'Item Secondary Text', description: 'Secondary/description text' },
    { id: 6, name: 'Item Bullets', description: 'Bullet point styles' },
    { id: 7, name: 'Item Link', description: 'Links within items' },
    { id: 8, name: '"Read on" Link', description: 'Read more link styles' },
    { id: 9, name: '"View all" Link', description: 'View all link styles' },
    { id: 10, name: '"RSS" Link', description: 'RSS feed link styles' },
    { id: 11, name: 'Footer', description: 'Widget footer styles' }
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
  var allSkins = {};
  var currentView = 'grid'; // 'grid' or 'list'
  var currentSkinView = 'list';
  var groupByCategory = false;
  var pageFilterState = createPageFilterState();
  var skinFilterState = createSkinFilterState();

  function getCategoryIcon(cat) {
    var key = (cat || '').toLowerCase();
    var svg = CATEGORY_ICONS[key] || '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + svg + '</svg>';
  }

  function getCategorySelectValue(category) {
    var value = category || 'Custom';
    var match = CATEGORIES.find(function(cat) {
      return cat.key.toLowerCase() === String(value).toLowerCase();
    });
    return match ? match.key : 'Custom';
  }

  function getCustomCategoryValue(category) {
    var value = category || '';
    var match = CATEGORIES.some(function(cat) {
      return cat.key.toLowerCase() === String(value).toLowerCase();
    });
    return match ? '' : value;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function createPageFilterState() {
    if (libraryView) {
      return libraryView.defaultState({
        includeSnippets: true,
        includeSkins: false,
        groupByCategory: false,
        sortBy: 'manual'
      });
    }

    return {
      query: '',
      category: '',
      groupByCategory: false,
      includeSnippets: true,
      includeSkins: false,
      sortBy: 'manual',
      userOnly: false,
      dynamicOnly: false,
      multiOnly: false,
      quickOnly: false,
      collapsedCategories: {}
    };
  }

  function createSkinFilterState() {
    if (libraryView) {
      return libraryView.defaultState({
        includeSnippets: false,
        includeSkins: true,
        groupByCategory: false,
        sortBy: 'newest'
      });
    }

    return {
      query: '',
      category: '',
      groupByCategory: false,
      includeSnippets: false,
      includeSkins: true,
      sortBy: 'newest',
      userOnly: false,
      dynamicOnly: false,
      multiOnly: false,
      quickOnly: false,
      collapsedCategories: {}
    };
  }

  function pageHasActiveFilters() {
    return !!(
      pageFilterState.query ||
      pageFilterState.category ||
      pageFilterState.groupByCategory ||
      pageFilterState.sortBy !== 'manual' ||
      pageFilterState.userOnly ||
      pageFilterState.dynamicOnly ||
      pageFilterState.multiOnly ||
      pageFilterState.quickOnly
    );
  }

  function skinsHaveActiveFilters() {
    return !!(
      skinFilterState.query ||
      skinFilterState.category ||
      skinFilterState.groupByCategory ||
      skinFilterState.sortBy !== 'newest'
    );
  }

  function getSnippetSearchText(key, snippet) {
    var componentText = '';
    if (snippet.components) {
      componentText = Object.keys(snippet.components).map(function(compId) {
        return getComponentCode(snippet.components[compId]);
      }).join('\n');
    }

    return [
      key,
      snippet.name,
      snippet.category,
      snippet.description,
      snippet.code,
      componentText
    ].join(' ').toLowerCase();
  }

  function getFilteredSnippetEntries() {
    if (libraryView) {
      return libraryView.getSnippetEntries(allSnippets, pageFilterState, []);
    }

    var query = (pageFilterState.query || '').toLowerCase().trim();
    var selectedCategory = (pageFilterState.category || '').toLowerCase();

    return Object.entries(allSnippets).filter(function(entry) {
      var snippet = entry[1] || {};
      var hasComponents = snippet.components && Object.keys(snippet.components).length > 0;
      if (pageFilterState.userOnly && snippet.isUserSnippet !== true) return false;
      if (pageFilterState.dynamicOnly && snippet.dynamicSelector !== true) return false;
      if (pageFilterState.multiOnly && !hasComponents) return false;
      if (pageFilterState.quickOnly && snippet.alwaysInQuickList !== true) return false;
      if (selectedCategory && (snippet.category || 'Uncategorized').toLowerCase() !== selectedCategory) return false;
      if (!query) return true;
      return getSnippetSearchText(entry[0], snippet).indexOf(query) !== -1;
    }).sort(function(a, b) {
      if (pageFilterState.sortBy === 'name') {
        return String(a[1].name || a[0]).localeCompare(String(b[1].name || b[0]));
      }
      if (pageFilterState.sortBy === 'category') {
        return String(a[1].category || '').localeCompare(String(b[1].category || '')) ||
          String(a[1].name || a[0]).localeCompare(String(b[1].name || b[0]));
      }
      if (pageFilterState.sortBy === 'newest') {
        var aDate = new Date(a[1].updatedAt || a[1].savedAt || a[1].createdAt || 0).getTime() || 0;
        var bDate = new Date(b[1].updatedAt || b[1].savedAt || b[1].createdAt || 0).getTime() || 0;
        return bDate - aDate;
      }
      return 0;
    });
  }

  function getFilteredSkinEntries() {
    if (libraryView) {
      return libraryView.getSkinEntries(allSkins, skinFilterState);
    }

    var query = (skinFilterState.query || '').toLowerCase().trim();
    var selectedCategory = (skinFilterState.category || '').toLowerCase();

    return Object.entries(allSkins).filter(function(entry) {
      var skin = entry[1] || {};
      if (selectedCategory && (skin.category || 'Uncategorized').toLowerCase() !== selectedCategory) return false;
      if (!query) return true;
      var components = Array.isArray(skin.components)
        ? skin.components.map(function(component) { return [component.type, component.view, component.idx].join(' '); }).join(' ')
        : '';
      return [
        entry[0],
        skin.name,
        skin.category,
        skin.description,
        skin.sourceSite,
        skin.sourceUrl,
        skin.sourceSkinName,
        skin.sourceSkinID,
        components
      ].join(' ').toLowerCase().indexOf(query) !== -1;
    }).sort(function(a, b) {
      if (skinFilterState.sortBy === 'name') {
        return String(a[1].name || a[0]).localeCompare(String(b[1].name || b[0]));
      }
      if (skinFilterState.sortBy === 'category') {
        return String(a[1].category || 'Uncategorized').localeCompare(String(b[1].category || 'Uncategorized')) ||
          String(a[1].name || a[0]).localeCompare(String(b[1].name || b[0]));
      }
      var aDate = new Date(a[1].savedAt || a[1].updatedAt || 0).getTime() || 0;
      var bDate = new Date(b[1].savedAt || b[1].updatedAt || 0).getTime() || 0;
      return bDate - aDate;
    });
  }

  function getPageCategoryOptions() {
    if (libraryView) {
      return libraryView.getCategoryOptions(allSnippets, {});
    }

    var seen = {};
    Object.keys(allSnippets || {}).forEach(function(key) {
      var category = allSnippets[key].category || 'Uncategorized';
      seen[category] = true;
    });
    return Object.keys(seen).sort();
  }

  function getSkinCategoryOptions() {
    if (libraryView) {
      return libraryView.getCategoryOptions({}, allSkins);
    }

    var seen = {};
    Object.keys(allSkins || {}).forEach(function(key) {
      var category = allSkins[key].category || 'Uncategorized';
      seen[category] = true;
    });
    return Object.keys(seen).sort();
  }

  function buildPageFilterControls() {
    var categories = getPageCategoryOptions();
    var categoryOptions = '<option value="">All categories</option>' + categories.map(function(category) {
      var selected = category === pageFilterState.category ? ' selected' : '';
      return '<option value="' + escapeHtml(category) + '"' + selected + '>' + escapeHtml(category) + '</option>';
    }).join('');
    var checked = function(value) { return value ? ' checked' : ''; };

    return '' +
      '<div class="library-filter-grid">' +
        '<label class="library-filter-field"><span>Category</span><select data-page-filter="category">' + categoryOptions + '</select></label>' +
        '<label class="library-filter-field"><span>Sort</span><select data-page-filter="sortBy">' +
          '<option value="manual"' + (pageFilterState.sortBy === 'manual' ? ' selected' : '') + '>Manual</option>' +
          '<option value="name"' + (pageFilterState.sortBy === 'name' ? ' selected' : '') + '>Name</option>' +
          '<option value="category"' + (pageFilterState.sortBy === 'category' ? ' selected' : '') + '>Category</option>' +
          '<option value="newest"' + (pageFilterState.sortBy === 'newest' ? ' selected' : '') + '>Newest</option>' +
        '</select></label>' +
      '</div>' +
      '<label class="library-filter-check"><input type="checkbox" data-page-filter="groupByCategory"' + checked(pageFilterState.groupByCategory) + '> Group into category sections</label>' +
      '<label class="library-filter-check"><input type="checkbox" data-page-filter="userOnly"' + checked(pageFilterState.userOnly) + '> User snippets only</label>' +
      '<label class="library-filter-check"><input type="checkbox" data-page-filter="dynamicOnly"' + checked(pageFilterState.dynamicOnly) + '> Dynamic snippets only</label>' +
      '<label class="library-filter-check"><input type="checkbox" data-page-filter="multiOnly"' + checked(pageFilterState.multiOnly) + '> Multi-component only</label>' +
      '<label class="library-filter-check"><input type="checkbox" data-page-filter="quickOnly"' + checked(pageFilterState.quickOnly) + '> Quick-list snippets only</label>' +
      '<button type="button" class="library-filter-reset">Reset filters</button>';
  }

  function buildSkinFilterControls() {
    var categories = getSkinCategoryOptions();
    var categoryOptions = '<option value="">All categories</option>' + categories.map(function(category) {
      var selected = category === skinFilterState.category ? ' selected' : '';
      return '<option value="' + escapeHtml(category) + '"' + selected + '>' + escapeHtml(category) + '</option>';
    }).join('');
    var checked = function(value) { return value ? ' checked' : ''; };

    return '' +
      '<div class="library-filter-grid">' +
        '<label class="library-filter-field"><span>Category</span><select data-skin-filter="category">' + categoryOptions + '</select></label>' +
        '<label class="library-filter-field"><span>Sort</span><select data-skin-filter="sortBy">' +
          '<option value="newest"' + (skinFilterState.sortBy === 'newest' ? ' selected' : '') + '>Newest</option>' +
          '<option value="name"' + (skinFilterState.sortBy === 'name' ? ' selected' : '') + '>Name</option>' +
          '<option value="category"' + (skinFilterState.sortBy === 'category' ? ' selected' : '') + '>Category</option>' +
        '</select></label>' +
      '</div>' +
      '<label class="library-filter-check"><input type="checkbox" data-skin-filter="groupByCategory"' + checked(skinFilterState.groupByCategory) + '> Group into category sections</label>' +
      '<button type="button" class="library-filter-reset">Reset filters</button>';
  }

  function renderPageFilterControls() {
    var popover = document.getElementById('snippet-library-filter-popover');
    var filterBtn = document.getElementById('btn-filter-snippets');
    var categoryBtn = document.getElementById('btn-sort-category');
    if (popover) popover.innerHTML = buildPageFilterControls();
    if (filterBtn) filterBtn.classList.toggle('active', pageHasActiveFilters());
    if (categoryBtn) categoryBtn.classList.toggle('active', !!pageFilterState.groupByCategory);
  }

  function renderSkinFilterControls() {
    var popover = document.getElementById('skin-library-filter-popover');
    var filterBtn = document.getElementById('btn-filter-skins');
    var categoryBtn = document.getElementById('btn-sort-skins-category');
    if (popover) popover.innerHTML = buildSkinFilterControls();
    if (filterBtn) filterBtn.classList.toggle('active', skinsHaveActiveFilters());
    if (categoryBtn) categoryBtn.classList.toggle('active', !!skinFilterState.groupByCategory);
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

  function getComponentCode(component) {
    if (libraryStore) return libraryStore.getComponentCode(component);
    if (typeof component === 'string') return component;
    if (component && typeof component === 'object' && typeof component.code === 'string') return component.code;
    return '';
  }

  function getComponentLabel(compId, component, snippet) {
    if (libraryStore) return libraryStore.getComponentLabel(compId, component, snippet);
    if (component && typeof component === 'object' && component.label) return component.label;
    var comp = SKIN_COMPONENT_TYPES.find(function(item) {
      return item.id === parseInt(compId, 10);
    });
    return comp ? comp.name : 'Component ' + compId;
  }

  // ==================== STORAGE ====================

  function saveSnippets(callback) {
    if (libraryStore) {
      libraryStore.saveUserSnippets(allSnippets).then(function() {
        allSnippets = libraryStore.normalizeSnippetCollection(allSnippets || {});
        if (callback) callback();
      }).catch(function(err) {
        console.error('[CP Toolkit](snippets-page) Failed to save snippets:', err);
        if (callback) callback(err);
      });
      return;
    }

    chrome.storage.local.set({ [USER_SNIPPETS_KEY]: allSnippets }, callback);
  }

  function saveSkins(callback) {
    if (libraryStore) {
      libraryStore.saveCopiedSkins(allSkins).then(function() {
        allSkins = libraryStore.normalizeSkinCollection(allSkins || {});
        if (callback) callback();
      }).catch(function(err) {
        console.error('[CP Toolkit](snippets-page) Failed to save skins:', err);
        if (callback) callback(err);
      });
      return;
    }

    chrome.storage.local.set({ [COPIED_SKINS_KEY]: allSkins }, callback);
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
        var component = snippet.components[compId];
        var tab = document.createElement('button');
        tab.className = 'component-tab' + (idx === 0 ? ' active' : '');
        tab.textContent = getComponentLabel(compId, component, snippet);
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
        var code = getComponentCode(snippet.components[compId]);
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

  function formatDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString();
  }

  function buildSkinCard(key, skin) {
    var card = document.createElement('div');
    card.className = 'snippet-card skin-card';
    card.setAttribute('data-key', key);

    var componentCount = skin.components ? skin.components.length : 0;
    var sourceSite = skin.sourceSite || (skin.sourceUrl || '').replace(/^https?:\/\//, '');
    var savedDate = formatDate(skin.savedAt || skin.updatedAt);
    var badges = '<span class="skin-badge">Skin</span>';
    if (skin.category) {
      badges += '<span class="category-pill">' + escapeHtml(skin.category) + '</span>';
    }

    var header = document.createElement('div');
    header.className = 'snippet-card-header';
    header.innerHTML =
      '<div class="snippet-card-title">' +
        escapeHtml(skin.name || key) + badges +
      '</div>' +
      '<div class="snippet-card-actions">' +
        '<button class="btn-delete" title="Delete">Delete</button>' +
      '</div>' +
      '<span class="snippet-card-chevron">' + chevronSVG + '</span>';

    header.addEventListener('click', function(e) {
      if (e.target.closest('.snippet-card-actions')) return;
      card.classList.toggle('expanded');
    });

    header.querySelector('.btn-delete').addEventListener('click', function(e) {
      e.stopPropagation();
      if (confirm('Delete saved skin "' + (skin.name || key) + '"?')) {
        delete allSkins[key];
        saveSkins(function() { renderSkins(); });
      }
    });

    card.appendChild(header);

    var body = document.createElement('div');
    body.className = 'snippet-card-body';

    var meta = document.createElement('div');
    meta.className = 'snippet-card-meta';
    meta.innerHTML =
      '<span>' + componentCount + ' component(s)</span>' +
      (savedDate ? '<span>Saved ' + escapeHtml(savedDate) + '</span>' : '') +
      (sourceSite ? '<span>' + escapeHtml(sourceSite) + '</span>' : '');
    body.appendChild(meta);

    var details = document.createElement('div');
    details.className = 'skin-card-details';

    if (skin.sourceSkinName || skin.sourceSkinID) {
      var source = document.createElement('div');
      source.className = 'skin-source-line';
      source.textContent = 'Source: ' +
        (skin.sourceSkinName || 'Skin') +
        (skin.sourceSkinID ? ' (' + skin.sourceSkinID + ')' : '');
      details.appendChild(source);
    }

    if (componentCount > 0) {
      var list = document.createElement('div');
      list.className = 'skin-component-list';
      skin.components.forEach(function(component) {
        var item = document.createElement('div');
        item.className = 'skin-component-item';
        var label = component.type || getComponentLabel(component.idx, null, null);
        item.innerHTML =
          '<span class="skin-component-name">' + escapeHtml(label) + '</span>' +
          (component.view ? '<span class="skin-component-view">' + escapeHtml(component.view) + '</span>' : '');
        list.appendChild(item);
      });
      details.appendChild(list);
    }

    body.appendChild(details);
    card.appendChild(body);
    return card;
  }

  // ==================== RENDER ====================

  function renderSnippets() {
    var grid = document.getElementById('snippets-grid');
    var emptyState = document.getElementById('snippets-empty');
    grid.innerHTML = '';
    groupByCategory = !!pageFilterState.groupByCategory;
    renderPageFilterControls();

    var entries = getFilteredSnippetEntries();
    if (entries.length === 0) {
      emptyState.style.display = 'block';
      grid.className = '';
      var emptyTitle = emptyState.querySelector('h3');
      var emptyText = emptyState.querySelector('p');
      if (Object.keys(allSnippets).length > 0) {
        if (emptyTitle) emptyTitle.textContent = 'No Matching Snippets';
        if (emptyText) emptyText.textContent = 'Try clearing filters or broadening your search.';
      } else {
        if (emptyTitle) emptyTitle.textContent = 'No Snippets Yet';
        if (emptyText) emptyText.textContent = 'Add snippets from the sidebar in the CMS Theme Manager, or click "New Snippet" above.';
      }
      return;
    }
    emptyState.style.display = 'none';

    if (pageFilterState.groupByCategory) {
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

  function renderSkinCategoryView(grid, entries) {
    grid.className = currentSkinView === 'grid' ? 'view-grid skin-grid' : 'skin-grid';

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
      section.className = 'category-section skin-category-section';

      var header = document.createElement('div');
      header.className = 'category-header';
      header.innerHTML =
        '<span class="category-icon">' + icon + '</span>' +
        '<span class="category-name">' + escapeHtml(label) + '</span>' +
        '<span class="category-count">' + items.length + '</span>';
      section.appendChild(header);

      if (currentSkinView === 'grid') {
        var wrap = document.createElement('div');
        wrap.className = 'snippet-cards-wrap';
        items.forEach(function(entry) { wrap.appendChild(buildSkinCard(entry[0], entry[1])); });
        section.appendChild(wrap);
      } else {
        items.forEach(function(entry) { section.appendChild(buildSkinCard(entry[0], entry[1])); });
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

  function renderSkins() {
    var grid = document.getElementById('skins-grid');
    var emptyState = document.getElementById('skins-empty');
    if (!grid || !emptyState) return;

    grid.innerHTML = '';
    grid.className = currentSkinView === 'grid' ? 'view-grid skin-grid' : 'skin-grid';
    renderSkinFilterControls();

    var entries = getFilteredSkinEntries();
    if (entries.length === 0) {
      emptyState.style.display = 'block';
      var emptyTitle = emptyState.querySelector('h3');
      var emptyText = emptyState.querySelector('p');
      if (Object.keys(allSkins).length > 0) {
        if (emptyTitle) emptyTitle.textContent = 'No Matching Saved Skins';
        if (emptyText) emptyText.textContent = 'Try clearing filters or broadening your search.';
      } else {
        if (emptyTitle) emptyTitle.textContent = 'No Saved Skins Yet';
        if (emptyText) emptyText.textContent = 'Save widget skins from the snippets sidebar in Theme Manager.';
      }
      return;
    }

    emptyState.style.display = 'none';

    if (skinFilterState.groupByCategory) {
      renderSkinCategoryView(grid, entries);
    } else {
      entries.forEach(function(entry) {
        grid.appendChild(buildSkinCard(entry[0], entry[1]));
      });
    }
  }

  // ==================== MODAL ====================

  function openModal(key, snippet) {
    var overlay = document.getElementById('snippet-modal-overlay');
    var title = document.getElementById('snippet-modal-title');
    var nameInput = document.getElementById('snippet-name');
    var categorySelect = document.getElementById('snippet-category');
    var categoryHint = document.getElementById('snippet-category-hint');
    var customCategoryWrap = document.getElementById('snippet-custom-category-wrap');
    var customCategoryInput = document.getElementById('snippet-custom-category');
    var multiComponentCheck = document.getElementById('snippet-multi-component');
    var singleCodeWrap = document.getElementById('snippet-single-code-wrap');
    var multiComponentWrap = document.getElementById('snippet-multi-component-wrap');
    var componentGrid = document.getElementById('snippet-component-grid');
    var componentEditors = document.getElementById('snippet-component-editors');
    var codeTextarea = document.getElementById('snippet-code');
    var dynamicCheck = document.getElementById('snippet-dynamic');
    var quicklistCheck = document.getElementById('snippet-quicklist');
    var deleteBtn = document.getElementById('snippet-modal-delete');
    var saveBtn = document.getElementById('snippet-modal-save');

    var isEdit = !!key;
    var hasComponents = !!(snippet && snippet.components && Object.keys(snippet.components).length > 0);

    title.textContent = isEdit ? 'Edit Snippet' : 'New Snippet';
    deleteBtn.style.display = isEdit ? '' : 'none';
    componentGrid.innerHTML = SKIN_COMPONENT_TYPES.map(function(comp) {
      return '<label class="component-checkbox-label" title="' + escapeHtml(comp.description) + '">' +
        '<input type="checkbox" value="' + comp.id + '" />' +
        '<span>' + escapeHtml(comp.name) + '</span>' +
      '</label>';
    }).join('');

    if (isEdit && snippet) {
      nameInput.value = snippet.name || '';
      categorySelect.value = getCategorySelectValue(snippet.category);
      customCategoryInput.value = getCustomCategoryValue(snippet.category);
      codeTextarea.value = snippet.code || '';
      dynamicCheck.checked = !!snippet.dynamicSelector;
      quicklistCheck.checked = !!snippet.alwaysInQuickList;
      multiComponentCheck.checked = hasComponents;

      if (hasComponents) {
        componentGrid.querySelectorAll('input[type="checkbox"]').forEach(function(input) {
          input.checked = Object.prototype.hasOwnProperty.call(snippet.components, input.value);
        });
      }
    } else {
      nameInput.value = '';
      categorySelect.value = 'Custom';
      customCategoryInput.value = '';
      codeTextarea.value = '';
      dynamicCheck.checked = false;
      quicklistCheck.checked = false;
      multiComponentCheck.checked = false;
      componentGrid.querySelectorAll('input[type="checkbox"]').forEach(function(input) {
        input.checked = input.value === '0';
      });
    }

    function updateCategoryFields() {
      var selected = categorySelect.value;
      var category = CATEGORIES.find(function(cat) { return cat.key === selected; });
      if (customCategoryWrap) {
        customCategoryWrap.style.display = selected === 'Custom' ? 'block' : 'none';
      }
      if (categoryHint) {
        categoryHint.textContent = category && selected !== 'Custom' ? category.description : '';
        categoryHint.style.display = categoryHint.textContent ? 'block' : 'none';
      }
    }

    function buildComponentEditors() {
      var currentValues = {};
      componentEditors.querySelectorAll('.snippet-component-editor').forEach(function(editor) {
        var compId = editor.getAttribute('data-component-id');
        currentValues[compId] = editor.querySelector('textarea').value;
      });
      var selectedInputs = Array.from(componentGrid.querySelectorAll('input[type="checkbox"]:checked'));
      selectedInputs.sort(function(a, b) {
        return parseInt(a.value, 10) - parseInt(b.value, 10);
      });

      componentEditors.innerHTML = selectedInputs.map(function(input) {
        var compId = input.value;
        var comp = SKIN_COMPONENT_TYPES.find(function(item) {
          return item.id === parseInt(compId, 10);
        });
        var component = snippet && snippet.components ? snippet.components[compId] : null;
        var code = Object.prototype.hasOwnProperty.call(currentValues, compId) ? currentValues[compId] : getComponentCode(component);
        var label = comp ? comp.name : getComponentLabel(compId, component, snippet);
        return '<div class="snippet-component-editor" data-component-id="' + escapeHtml(compId) + '">' +
          '<div class="snippet-component-editor-header">' + escapeHtml(label) + '</div>' +
          '<textarea rows="8" placeholder="/* ' + escapeHtml(label) + ' styles */">' + escapeHtml(code) + '</textarea>' +
        '</div>';
      }).join('');
    }

    function updateComponentMode() {
      var isMulti = multiComponentCheck.checked;
      singleCodeWrap.style.display = isMulti ? 'none' : 'block';
      multiComponentWrap.style.display = isMulti ? 'block' : 'none';
      if (isMulti) buildComponentEditors();
    }

    updateCategoryFields();
    updateComponentMode();

    overlay.style.display = 'flex';
    setTimeout(function() { nameInput.focus(); }, 50);

    categorySelect.onchange = updateCategoryFields;
    multiComponentCheck.onchange = updateComponentMode;
    componentGrid.onchange = function(e) {
      if (e.target && e.target.matches('input[type="checkbox"]')) {
        buildComponentEditors();
      }
    };

    // Clean up old handlers by cloning buttons
    var newSave = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSave, saveBtn);
    var newDelete = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDelete, deleteBtn);

    // Save
    newSave.addEventListener('click', function() {
      var name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }

      var selectedCategory = categorySelect.value;
      var customCategory = customCategoryInput.value.trim();
      var category = selectedCategory === 'Custom' ? (customCategory || 'Custom') : selectedCategory;
      var isMultiComponent = multiComponentCheck.checked;
      var snippetData = {
        name: name,
        category: category || undefined,
        dynamicSelector: dynamicCheck.checked || undefined,
        alwaysInQuickList: quicklistCheck.checked || undefined,
        isUserSnippet: true
      };

      if (isMultiComponent) {
        var components = {};
        var hasAnyCode = false;
        componentEditors.querySelectorAll('.snippet-component-editor').forEach(function(editor) {
          var compId = editor.getAttribute('data-component-id');
          var code = editor.querySelector('textarea').value;
          if (code.trim()) {
            components[compId] = code;
            hasAnyCode = true;
          }
        });

        if (!hasAnyCode) {
          alert('Please enter CSS code for at least one component.');
          return;
        }

        snippetData.components = components;
        snippetData.code = '';
      } else {
        var code = codeTextarea.value;
        if (!code.trim()) {
          codeTextarea.focus();
          return;
        }
        snippetData.code = code;
      }

      var saveKey = isEdit ? key : generateSnippetKey(name);
      allSnippets[saveKey] = libraryStore ? libraryStore.normalizeSnippet(snippetData) : snippetData;

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
      pageFilterState.groupByCategory = !pageFilterState.groupByCategory;
      groupByCategory = pageFilterState.groupByCategory;
      catBtn.classList.toggle('active', pageFilterState.groupByCategory);
      renderSnippets();
    });

    // Search and filters
    var searchInput = document.getElementById('snippet-library-search');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        pageFilterState.query = searchInput.value;
        renderSnippets();
      });
    }

    var filterBtn = document.getElementById('btn-filter-snippets');
    var filterPopover = document.getElementById('snippet-library-filter-popover');
    if (filterBtn && filterPopover) {
      filterBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        filterPopover.classList.toggle('open');
      });

      filterPopover.addEventListener('change', function(e) {
        var control = e.target.closest('[data-page-filter]');
        if (!control) return;
        var field = control.getAttribute('data-page-filter');
        pageFilterState[field] = control.type === 'checkbox' ? control.checked : control.value;
        if (field === 'groupByCategory') {
          groupByCategory = pageFilterState.groupByCategory;
        }
        renderSnippets();
      });

      filterPopover.addEventListener('click', function(e) {
        var resetBtn = e.target.closest('.library-filter-reset');
        if (!resetBtn) return;
        e.preventDefault();
        pageFilterState = createPageFilterState();
        groupByCategory = false;
        if (searchInput) searchInput.value = '';
        renderSnippets();
      });
    }

    // New snippet
    document.getElementById('btn-new-snippet').addEventListener('click', function() {
      openModal(null, null);
    });

    // Saved skin view toggle
    document.querySelectorAll('.skin-view-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.skin-view-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentSkinView = btn.getAttribute('data-view');
        renderSkins();
      });
    });

    var skinCatBtn = document.getElementById('btn-sort-skins-category');
    if (skinCatBtn) {
      skinCatBtn.addEventListener('click', function() {
        skinFilterState.groupByCategory = !skinFilterState.groupByCategory;
        skinCatBtn.classList.toggle('active', skinFilterState.groupByCategory);
        renderSkins();
      });
    }

    var skinSearchInput = document.getElementById('skin-library-search');
    if (skinSearchInput) {
      skinSearchInput.addEventListener('input', function() {
        skinFilterState.query = skinSearchInput.value;
        renderSkins();
      });
    }

    var skinFilterBtn = document.getElementById('btn-filter-skins');
    var skinFilterPopover = document.getElementById('skin-library-filter-popover');
    if (skinFilterBtn && skinFilterPopover) {
      skinFilterBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        skinFilterPopover.classList.toggle('open');
      });

      skinFilterPopover.addEventListener('change', function(e) {
        var control = e.target.closest('[data-skin-filter]');
        if (!control) return;
        var field = control.getAttribute('data-skin-filter');
        skinFilterState[field] = control.type === 'checkbox' ? control.checked : control.value;
        renderSkins();
      });

      skinFilterPopover.addEventListener('click', function(e) {
        var resetBtn = e.target.closest('.library-filter-reset');
        if (!resetBtn) return;
        e.preventDefault();
        skinFilterState = createSkinFilterState();
        if (skinSearchInput) skinSearchInput.value = '';
        renderSkins();
      });
    }
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
    if (libraryStore) {
      libraryStore.loadLibrary().then(function(library) {
        allSnippets = library.snippets || {};
        allSkins = library.skins || {};
        renderSnippets();
        renderSkins();
      }).catch(function(err) {
        console.error('[CP Toolkit](snippets-page) Failed to load library:', err);
        allSnippets = {};
        allSkins = {};
        renderSnippets();
        renderSkins();
      });
      return;
    }

    chrome.storage.local.get([USER_SNIPPETS_KEY, COPIED_SKINS_KEY], function(result) {
      allSnippets = result[USER_SNIPPETS_KEY] || {};
      allSkins = result[COPIED_SKINS_KEY] || {};
      renderSnippets();
      renderSkins();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
