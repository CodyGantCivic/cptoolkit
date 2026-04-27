# Security Hardening: Replace Generic MAIN-World Eval Bridge

## Goal

Remove the generic `cp-execute-in-main` and `cp-execute-in-frame` execution bridge from the toolkit without breaking the tools that currently depend on page-context access.

This hardening keeps the supported tool behaviors, but narrows the trust boundary from:

- "run any code string in MAIN world"

to:

- "run only a small, allowlisted set of named operations for known tools"

## Baseline

Branch for this work:

- `security/replace-exec-bridge`

Primary files changed:

- `mv3-extension/js/background/service-worker.js`
- `mv3-extension/js/tools/on-load/cp-MultipleQuickLinks.js`
- `mv3-extension/js/tools/on-load/cp-ImportFancyButton.js`

## What Changed

### 1. Removed the generic execution primitive

The old service worker handlers:

- `cp-execute-in-main`
- `cp-execute-in-frame`

used `eval(codeStr)` inside `chrome.scripting.executeScript(...)`.

Those handlers were replaced with tool-specific operations:

- `cp-fancy-button-frame-operation`
- `cp-fancy-button-main-operation`

Only known operations are supported.

### 2. Removed bridge usage from `cp-MultipleQuickLinks`

Old behavior:

- used `cp-execute-in-main` to clone/show a loading overlay from page context
- used `cp-execute-in-main` again to hide it

New behavior:

- creates a toolkit-owned overlay directly from the content script
- no MAIN-world bridge call is needed

Reason:

- this behavior never required arbitrary page code execution
- a local DOM overlay is safer and simpler

### 3. Replaced `cp-ImportFancyButton` code strings with named operations

The tool still needs page-context access for real CMS behaviors, but now it reaches them through explicit operations instead of raw code strings.

Frame operations:

- `read-folders`
  - target: `folder-modal`
  - purpose: read Document Center folders from the Ant Design tree rendered in the modal iframe
- `check-dropzone-ready`
  - target: `select-files`
  - purpose: verify the Dropzone instance exists before upload
- `add-file`
  - target: `select-files`
  - purpose: create a File from base64 data and add it to Dropzone
- `get-upload-status`
  - target: `select-files`
  - purpose: poll accepted/uploading/rejected state
- `trigger-continue`
  - target: `select-files`
  - purpose: call `window.parent.reloadPage(...)` after upload completes
- `probe-form`
  - target: `document-add`
  - purpose: detect when the outer add form is ready after reload
- `fill-metadata-and-submit`
  - target: `document-add`
  - purpose: fill blank metadata fields and submit the form

Main operations:

- `install-export-interceptor`
  - purpose: temporarily intercept the Graphic Link save AJAX call and capture the payload
- `read-export-capture`
  - purpose: read the captured payload from page context
- `clear-export-capture`
  - purpose: restore the original AJAX function and clear captured state

## Why This Is Safer

Before:

- any caller that could reach the bridge could ask the service worker to `eval` arbitrary code in page context

After:

- only a fixed set of named operations is supported
- each operation has known inputs and outputs
- there is no raw code transport from content script to MAIN world
- the operation surface is limited to the two known tools that actually need it

## Testing Checklist

### `cp-MultipleQuickLinks`

- open `/admin/quicklinks.aspx`
- add one or more toolkit-generated rows
- click `Save` and `Save and Publish`
- confirm:
  - the toolkit overlay appears
  - links are created in order
  - the overlay hides afterward
  - navigation back still occurs

### `cp-ImportFancyButton`

Folder lookup:

- open the social icon uploader flow
- confirm the folder list loads from the hidden `FolderForModal` iframe
- confirm clicking a folder sets the selected folder ID

Document upload:

- upload at least one icon through the hidden Document Center iframe flow
- confirm:
  - Dropzone becomes ready
  - file is added successfully
  - upload completes
  - `reloadPage` transitions back to the add form
  - metadata fills and submit occurs
  - the new document ID is verified afterward

Fancy button export:

- trigger export on a graphic link that has a fancy button
- confirm:
  - the temporary interceptor installs
  - clicking `Save and Publish` captures the outgoing payload
  - the export modal opens with captured data
  - cleanup restores the original AJAX function

## Troubleshooting

### Folder list does not load

Likely cause:

- the `FolderForModal` page changed its React tree structure or CSS selectors

Check:

- `.ant-tree-treenode`
- React fiber key lookup on tree nodes

### Upload times out waiting for Dropzone

Likely cause:

- the inner `MultipleFileUpload/SelectFiles` iframe path changed
- Dropzone initialization timing changed
- `.dropzone` selector or `Dropzone.instances[0]` behavior changed

Check:

- frame URL still contains `MultipleFileUpload/SelectFiles`
- Dropzone still exists in MAIN world

### Continue step fails

Likely cause:

- `window.parent.reloadPage` is no longer the right handoff

Check:

- the upload page still exposes `reloadPage` on the parent

### Form probe never becomes ready

Likely cause:

- `saveChanges` or `#olfileUploadControl` changed on the add form

Check:

- `DocumentCenter/DocumentForModal/Add` iframe still exposes `saveChanges`
- `#olfileUploadControl` still reflects uploaded file slots

### Fancy button export capture fails

Likely cause:

- the CMS stopped using `$.ajax` for `/GraphicLinks/GraphicLinkSave`
- the save endpoint changed
- the page jQuery object is missing or replaced

Check:

- page still posts to `/GraphicLinks/GraphicLinkSave`
- `window.jQuery.ajax` and `$.Deferred` still exist in MAIN world

## Reassessment Notes

If one of these operations breaks later, do not reintroduce a generic `eval` bridge as a shortcut.

Instead:

1. identify the exact page behavior that changed
2. update the specific named operation for that behavior
3. keep the interface narrow and tool-specific
