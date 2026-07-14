# CP Toolkit MV3 Extension

This folder is the Chrome extension source root. Load this directory as the unpacked extension when developing locally.

## Local Development

1. Open Chrome and go to `chrome://extensions`.
2. Enable `Developer mode`.
3. Choose `Load unpacked` and select this `mv3-extension` folder.
4. After changing `manifest.json`, content scripts, shared scripts, data files, or CSS loaded by the extension, click `Reload` on the extension card and refresh any open CMS tab.
5. After changing only an extension HTML page, refresh that extension page.

Use a separate local folder only when you intentionally need two unpacked versions loaded side by side. Do not commit copied extension folders or worktree folders.

## Recently Touched Feature Areas

- CSS snippets and saved widget skins:
  - `js/tools/on-load/css-snippets.js`
  - `js/snippets-page.js`
  - `js/shared/snippet-library-store.js`
  - `js/shared/snippet-library-view.js`
  - `html/snippets.html`
  - `css/snippets.css`
- Fancy Button library:
  - `js/tools/on-load/cp-ImportFancyButton.js`
  - `js/button-library-page.js`
  - `js/shared/fancy-button-library.js`
  - `html/button-library.html`
  - `css/button-library.css`

See `docs/snippet-skin-and-button-libraries.md` for data contracts, workflows, and maintenance notes for these libraries.

## Validation

Run syntax checks before handing off changes:

```powershell
node --check js/shared/snippet-library-store.js
node --check js/shared/snippet-library-view.js
node --check js/tools/on-load/css-snippets.js
node --check js/snippets-page.js
node --check js/shared/fancy-button-library.js
node --check js/tools/on-load/cp-ImportFancyButton.js
node --check js/button-library-page.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
git diff --check
```

`git diff --check` may report CRLF/LF warnings on Windows. Treat whitespace errors as blockers; line-ending warnings alone are expected in this repo.
