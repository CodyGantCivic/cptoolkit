// CivicPlus Toolkit - Frame-scoped ops for cp-ImportFancyButton (MAIN world)
// Each entry is { match, func }. The SW enumerates frames via
// chrome.webNavigation.getAllFrames and runs `func` in the first frame whose
// URL contains `match`. Functions are serialized via Function.prototype.toString
// and re-parsed in the target frame's MAIN world — fully self-contained,
// no closures, no `this`, only their args.

var FRAME_OPS = Object.create(null);

FRAME_OPS.readFolderTree = {
  match: 'FolderForModal/Index',
  func: function readFolderTree() {
    var treeNodes = document.querySelectorAll('.ant-tree-treenode');
    if (treeNodes.length === 0) return { ready: false };
    var folders = [];
    treeNodes.forEach(function (node) {
      var fiberKey = Object.keys(node).find(function (k) {
        return (
          k.indexOf('__reactFiber$') === 0 ||
          k.indexOf('__reactInternalInstance$') === 0
        );
      });
      if (!fiberKey) return;
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
    });
    return { ready: true, folders: folders };
  }
};

FRAME_OPS.checkDropzoneReady = {
  match: 'MultipleFileUpload/SelectFiles',
  func: function checkDropzoneReady() {
    var dz = document.querySelector('.dropzone');
    return {
      ready: !!(
        dz &&
        (dz.dropzone ||
          (typeof Dropzone !== 'undefined' &&
            Dropzone.instances &&
            Dropzone.instances.length > 0))
      )
    };
  }
};

FRAME_OPS.addFileToDropzone = {
  match: 'MultipleFileUpload/SelectFiles',
  func: function addFileToDropzone(args) {
    var base64 = args.base64;
    var filename = args.filename;
    var byteChars = atob(base64);
    var byteArray = new Uint8Array(byteChars.length);
    for (var i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    var file = new File([byteArray], filename, { type: 'image/svg+xml' });
    var dz =
      document.querySelector('.dropzone').dropzone ||
      (typeof Dropzone !== 'undefined' && Dropzone.instances[0]);
    if (!dz) return { error: 'Dropzone not found' };
    dz.addFile(file);
    return { status: 'added' };
  }
};

FRAME_OPS.pollDropzoneComplete = {
  match: 'MultipleFileUpload/SelectFiles',
  func: function pollDropzoneComplete() {
    var dz =
      document.querySelector('.dropzone').dropzone ||
      (typeof Dropzone !== 'undefined' && Dropzone.instances[0]);
    if (!dz) return { done: false, error: 'no dropzone' };
    var uploading = dz.getUploadingFiles().length;
    var accepted = dz.getAcceptedFiles().length;
    var rejected = dz.getRejectedFiles().length;
    return {
      done: uploading === 0 && accepted > 0,
      accepted: accepted,
      rejected: rejected
    };
  }
};

FRAME_OPS.triggerContinue = {
  match: 'MultipleFileUpload/SelectFiles',
  func: function triggerContinue() {
    var dz =
      document.querySelector('.dropzone').dropzone ||
      (typeof Dropzone !== 'undefined' && Dropzone.instances[0]);
    if (!dz) return { error: 'Dropzone not found for continue' };
    var files = dz.getAcceptedFiles();
    var fileList = files.map(function (f) {
      return f.name;
    });
    var fileSizes = files.map(function (f) {
      return f.size;
    });
    var categoryId = document.getElementById('categoryId')
      ? document.getElementById('categoryId').value
      : '0';

    if (typeof window.parent.reloadPage === 'function') {
      window.parent.reloadPage(
        files.length,
        categoryId,
        fileList,
        fileSizes,
        {},
        []
      );
      return { status: 'ok', fileCount: files.length };
    }
    return { error: 'reloadPage not found on parent' };
  }
};

FRAME_OPS.probeAddForm = {
  match: 'DocumentCenter/DocumentForModal/Add',
  func: function probeAddForm() {
    var ol = document.getElementById('olfileUploadControl');
    return {
      hasSaveChanges: typeof saveChanges === 'function',
      fileSlotCount: ol ? ol.children.length : 0
    };
  }
};

FRAME_OPS.fillAndSubmitAddForm = {
  match: 'DocumentCenter/DocumentForModal/Add',
  func: function fillAndSubmitAddForm(args) {
    var names = args.names;

    var allNameInputs = document.querySelectorAll('input[id*=__FileName]');
    var filled = 0;
    for (var i = 0; i < allNameInputs.length; i++) {
      if (
        !allNameInputs[i].value ||
        allNameInputs[i].value.trim() === ''
      ) {
        allNameInputs[i].value = names[filled] || names[0] || 'Social Icon';
        filled++;
      }
    }

    var allDescInputs = document.querySelectorAll(
      'input[id*=__FileDescription], textarea[id*=__FileDescription]'
    );
    var descFilled = 0;
    for (var j = 0; j < allDescInputs.length; j++) {
      if (
        !allDescInputs[j].value ||
        allDescInputs[j].value.trim() === ''
      ) {
        allDescInputs[j].value =
          names[descFilled] || names[0] || 'Social Icon';
        descFilled++;
      }
    }

    if (!document.aspnetForm) {
      return { error: 'aspnetForm not found' };
    }

    var connector =
      document.aspnetForm.action.indexOf('?') !== -1 ? '&' : '?';
    document.aspnetForm.action += connector + 'saveAction=publish';
    if (typeof ajaxPostBackStart === 'function') {
      ajaxPostBackStart();
    }
    document.aspnetForm.submit();
    return { status: 'submitted', filled: filled };
  }
};
