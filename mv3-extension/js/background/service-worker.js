// CivicPlus Toolkit - Service Worker (MV3)
// Version 1.1.0

console.log('[CP Toolkit] Service worker initializing...');

// Import modules
importScripts('context-menus.js');
importScripts('first-run.js');

console.log('[CP Toolkit] Service worker initialized');

function getFirstExecutionResult(results) {
  return results && results[0] ? results[0].result : null;
}

function executeMainWorldScript(tabId, func, args) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    world: 'MAIN',
    func: func,
    args: args || []
  }).then(getFirstExecutionResult);
}

function getFancyButtonFrameUrlMatch(target) {
  if (target === 'folder-modal') return 'FolderForModal/Index';
  if (target === 'select-files') return 'MultipleFileUpload/SelectFiles';
  if (target === 'document-add') return 'DocumentCenter/DocumentForModal/Add';
  throw new Error('Unsupported fancy button frame target: ' + target);
}

function findFrameIdByUrlMatch(tabId, urlMatch) {
  return chrome.webNavigation.getAllFrames({ tabId: tabId }).then(function(frames) {
    var targetFrame = frames.find(function(frame) {
      return frame.url && frame.url.indexOf(urlMatch) > -1;
    });
    if (!targetFrame) {
      throw new Error('Frame not found matching: ' + urlMatch);
    }
    return targetFrame.frameId;
  });
}

function executeFancyButtonFrameScript(tabId, target, func, args) {
  var urlMatch = getFancyButtonFrameUrlMatch(target);
  return findFrameIdByUrlMatch(tabId, urlMatch).then(function(frameId) {
    return chrome.scripting.executeScript({
      target: { tabId: tabId, frameIds: [frameId] },
      world: 'MAIN',
      func: func,
      args: args || []
    }).then(getFirstExecutionResult);
  });
}

function runFancyButtonFrameOperation(tabId, target, operation, payload) {
  if (operation === 'read-folders') {
    return executeFancyButtonFrameScript(tabId, target, function() {
      var treeNodes = document.querySelectorAll('.ant-tree-treenode');
      if (treeNodes.length === 0) return { ready: false };

      var folders = [];
      for (var index = 0; index < treeNodes.length; index++) {
        var node = treeNodes[index];
        var keys = Object.keys(node);
        var fiberKey = null;

        for (var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
          if (keys[keyIndex].indexOf('__reactFiber$') === 0 || keys[keyIndex].indexOf('__reactInternalInstance$') === 0) {
            fiberKey = keys[keyIndex];
            break;
          }
        }
        if (!fiberKey) continue;

        var current = node[fiberKey];
        for (var i = 0; i < 5 && current; i++) {
          if (current.memoizedProps && current.memoizedProps.eventKey) {
            var data = current.memoizedProps.data;
            var title = data ? data.title : null;
            var id = current.memoizedProps.eventKey;
            if (title && title !== 'Content') {
              folders.push({ id: id, title: title });
            }
            break;
          }
          current = current.return;
        }
      }

      return { ready: true, folders: folders };
    });
  }

  if (operation === 'check-dropzone-ready') {
    return executeFancyButtonFrameScript(tabId, target, function() {
      var dropzoneElement = document.querySelector('.dropzone');
      var dropzoneInstance = dropzoneElement && dropzoneElement.dropzone
        ? dropzoneElement.dropzone
        : (typeof Dropzone !== 'undefined' && Dropzone.instances && Dropzone.instances[0]);
      return { ready: !!dropzoneInstance };
    });
  }

  if (operation === 'add-file') {
    return executeFancyButtonFrameScript(tabId, target, function(base64Data, fileName) {
      if (!base64Data || !fileName) {
        return { error: 'Missing file data for upload' };
      }

      var byteChars;
      try {
        byteChars = atob(base64Data);
      } catch (error) {
        return { error: 'Invalid file data: ' + error.message };
      }

      var byteArray = new Uint8Array(byteChars.length);
      for (var i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }

      var file = new File([byteArray], fileName, {
        type: 'image/svg+xml'
      });

      var dropzoneElement = document.querySelector('.dropzone');
      var dropzoneInstance = dropzoneElement && dropzoneElement.dropzone
        ? dropzoneElement.dropzone
        : (typeof Dropzone !== 'undefined' && Dropzone.instances && Dropzone.instances[0]);
      if (!dropzoneInstance) {
        return { error: 'Dropzone not found' };
      }

      dropzoneInstance.addFile(file);
      return { status: 'added' };
    }, [payload && payload.base64Data ? payload.base64Data : '', payload && payload.fileName ? payload.fileName : '']);
  }

  if (operation === 'get-upload-status') {
    return executeFancyButtonFrameScript(tabId, target, function() {
      var dropzoneElement = document.querySelector('.dropzone');
      var dropzoneInstance = dropzoneElement && dropzoneElement.dropzone
        ? dropzoneElement.dropzone
        : (typeof Dropzone !== 'undefined' && Dropzone.instances && Dropzone.instances[0]);
      if (!dropzoneInstance) {
        return { done: false, error: 'Dropzone not found' };
      }

      var uploading = dropzoneInstance.getUploadingFiles().length;
      var accepted = dropzoneInstance.getAcceptedFiles().length;
      var rejected = dropzoneInstance.getRejectedFiles().length;
      return {
        done: uploading === 0 && accepted > 0,
        accepted: accepted,
        rejected: rejected
      };
    });
  }

  if (operation === 'trigger-continue') {
    return executeFancyButtonFrameScript(tabId, target, function() {
      var dropzoneElement = document.querySelector('.dropzone');
      var dropzoneInstance = dropzoneElement && dropzoneElement.dropzone
        ? dropzoneElement.dropzone
        : (typeof Dropzone !== 'undefined' && Dropzone.instances && Dropzone.instances[0]);
      if (!dropzoneInstance) {
        return { error: 'Dropzone not found for continue' };
      }

      var files = dropzoneInstance.getAcceptedFiles();
      var fileList = files.map(function(file) { return file.name; });
      var fileSizes = files.map(function(file) { return file.size; });
      var categoryIdInput = document.getElementById('categoryId');
      var categoryId = categoryIdInput ? categoryIdInput.value : '0';

      if (typeof window.parent.reloadPage !== 'function') {
        return { error: 'reloadPage not found on parent' };
      }

      window.parent.reloadPage(files.length, categoryId, fileList, fileSizes, {}, []);
      return { status: 'ok' };
    });
  }

  if (operation === 'probe-form') {
    return executeFancyButtonFrameScript(tabId, target, function() {
      var fileList = document.getElementById('olfileUploadControl');
      return {
        hasSaveChanges: typeof saveChanges === 'function',
        fileSlotCount: fileList ? fileList.children.length : 0
      };
    });
  }

  if (operation === 'fill-metadata-and-submit') {
    return executeFancyButtonFrameScript(tabId, target, function(name, names) {
      var hasNames = Array.isArray(names) && names.length > 0;
      if (!name && !hasNames) {
        return { error: 'Missing document name(s)' };
      }

      var allNameInputs = document.querySelectorAll('input[id*=__FileName]');
      var filled = 0;
      for (var i = 0; i < allNameInputs.length; i++) {
        if (!allNameInputs[i].value || allNameInputs[i].value.trim() === '') {
          allNameInputs[i].value = hasNames ? (names[filled] || names[0]) : name;
          filled++;
        }
      }

      var allDescriptionInputs = document.querySelectorAll('input[id*=__FileDescription], textarea[id*=__FileDescription]');
      var descFilled = 0;
      for (var j = 0; j < allDescriptionInputs.length; j++) {
        if (!allDescriptionInputs[j].value || allDescriptionInputs[j].value.trim() === '') {
          allDescriptionInputs[j].value = hasNames ? (names[descFilled] || names[0]) : name;
          descFilled++;
        }
      }

      if (!document.aspnetForm) {
        return { error: 'aspnetForm not found' };
      }

      var connector = document.aspnetForm.action.indexOf('?') !== -1 ? '&' : '?';
      document.aspnetForm.action += connector + 'saveAction=publish';
      if (typeof ajaxPostBackStart === 'function') {
        ajaxPostBackStart();
      }
      document.aspnetForm.submit();
      return { status: 'submitted', filled: filled };
    }, [payload && payload.name ? payload.name : '', payload && payload.names ? payload.names : null]);
  }

  return Promise.reject(new Error('Unsupported fancy button frame operation: ' + operation));
}

function runFancyButtonMainOperation(tabId, operation) {
  if (operation === 'install-export-interceptor') {
    return executeMainWorldScript(tabId, function() {
      var $ = window.jQuery;
      if (!$ || typeof $.ajax !== 'function' || typeof $.Deferred !== 'function') {
        return { error: 'jQuery.ajax unavailable in page context' };
      }

      if (typeof window.__cpToolkitRestoreCapturedSaveInterceptor === 'function') {
        window.__cpToolkitRestoreCapturedSaveInterceptor();
      }

      window.__cpToolkitCapturedSave = null;
      var originalAjax = $.ajax;
      var interceptor = function(opts) {
        if (
          opts &&
          typeof opts.url === 'string' &&
          opts.url.indexOf('/GraphicLinks/GraphicLinkSave') !== -1
        ) {
          var data = opts.data;
          window.__cpToolkitCapturedSave = typeof data === 'string' ? data : JSON.stringify(data);
          if (typeof window.__cpToolkitRestoreCapturedSaveInterceptor === 'function') {
            window.__cpToolkitRestoreCapturedSaveInterceptor();
          }
          return $.Deferred().promise();
        }
        return originalAjax.apply(this, arguments);
      };

      window.__cpToolkitRestoreCapturedSaveInterceptor = function() {
        if ($.ajax === interceptor) {
          $.ajax = originalAjax;
        }
        delete window.__cpToolkitRestoreCapturedSaveInterceptor;
      };

      $.ajax = interceptor;
      return { installed: true };
    });
  }

  if (operation === 'read-export-capture') {
    return executeMainWorldScript(tabId, function() {
      return window.__cpToolkitCapturedSave || null;
    });
  }

  if (operation === 'clear-export-capture') {
    return executeMainWorldScript(tabId, function() {
      if (typeof window.__cpToolkitRestoreCapturedSaveInterceptor === 'function') {
        window.__cpToolkitRestoreCapturedSaveInterceptor();
      }
      delete window.__cpToolkitCapturedSave;
      return null;
    });
  }

  return Promise.reject(new Error('Unsupported fancy button main operation: ' + operation));
}

// Installation event - delegate to first-run handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[CP Toolkit] Extension installed/updated:', details.reason);
  
  // Use the first-run handler for install/update logic
  if (self.firstRunHandler && self.firstRunHandler.onInstalledHandler) {
    self.firstRunHandler.onInstalledHandler(details);
  } else {
    console.error('[CP Toolkit] First-run handler not loaded!');
  }
});

// Prevent-timeout alarm: fires every 2 minutes to notify content scripts.
// Uses chrome.alarms because content script setInterval gets throttled in background tabs (Chrome 88+).
// Content scripts check for the Session Timeout modal and click "Refresh Session" if visible.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cp-prevent-timeout') {
    chrome.storage.local.get('prevent-timeout', (settings) => {
      if (settings['prevent-timeout'] === false) return;

      chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
        for (const tab of tabs) {
          if (!tab.id || tab.id === chrome.tabs.TAB_ID_NONE) continue;
          chrome.tabs.sendMessage(tab.id, { action: 'cp-check-timeout' }).catch(() => {});
        }
      });
    });
  }
});

// Create the prevent-timeout alarm on startup (idempotent - won't duplicate)
chrome.alarms.get('cp-prevent-timeout', (existing) => {
  if (!existing) {
    chrome.alarms.create('cp-prevent-timeout', { periodInMinutes: 2 });
    console.log('[CP Toolkit] Created prevent-timeout alarm (every 2 min)');
  }
});

// Keep service worker alive (MV3 best practice)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[CP Toolkit] Message received:', message);

  // Show badge with refresh count from prevent-timeout
  if (message && message.action === 'cp-update-badge') {
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    chrome.action.setBadgeText({ text: message.text || '' });
  }

  // Open an extension page in a new tab (content scripts can't open chrome-extension:// URLs)
  if (message && message.action === 'cp-open-extension-page' && message.page) {
    chrome.tabs.create({ url: chrome.runtime.getURL(message.page) });
  }

  // Rebuild context menus (triggered when on-demand tools are enabled/disabled in options)
  if (message && message.action === 'cp-rebuild-context-menus') {
    initializeContextMenus(true);
  }

  if (message && message.action === 'cp-fancy-button-frame-operation' && sender.tab) {
    runFancyButtonFrameOperation(
      sender.tab.id,
      message.target,
      message.operation,
      message.payload || {}
    ).then(function(result) {
      sendResponse({ result: result });
    }).catch(function(err) {
      sendResponse({ error: err.message });
    });
    return true; // async response
  }

  if (message && message.action === 'cp-fancy-button-main-operation' && sender.tab) {
    runFancyButtonMainOperation(sender.tab.id, message.operation)
      .then(function(result) {
        sendResponse({ result: result });
      })
      .catch(function(err) {
        sendResponse({ error: err.message });
      });
    return true; // async response
  }

  sendResponse({ received: true });
  return true;
});

// Service worker lifecycle logging
self.addEventListener('activate', (event) => {
  console.log('[CP Toolkit] Service worker activated');
});

self.addEventListener('deactivate', (event) => {
  console.log('[CP Toolkit] Service worker deactivated');
});
