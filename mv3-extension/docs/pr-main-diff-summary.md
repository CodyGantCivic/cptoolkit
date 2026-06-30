# PR Prep: Toolkit Libraries and Option Set Importer

Base branch: `origin/main`
Base commit: `10154a5cb9db00d8c2f4845990e99e860cd565f9`
Working branch: `codex/snippet-library-v2`
Prepared: `2026-06-29`

The branch currently has no committed divergence from `main`; all PR content is in the working tree. Stage intentionally after reviewing this scope.

## Suggested PR Title

`[codex] Add reusable toolkit libraries for snippets, skins, buttons, and option sets`

## Suggested PR Body

### Summary

- Adds shared local-library infrastructure for CSS snippets, copied widget skins, Fancy Button templates, and Widget Manager option sets.
- Adds full-page and sidebar/flyout UI improvements for searching, filtering, grouping, categorizing, importing, and exporting saved toolkit assets.
- Adds a guarded Option Set Importer that only opens from Widget Manager and creates new CMS option sets before applying saved settings.
- Adds developer documentation for local extension setup, data contracts, manual QA, and PR scope.

### Why

The toolkit already had several one-off import/export flows, but similar reusable assets were handled differently across surfaces. This change moves common library behavior into shared helpers where practical, preserves backward compatibility with existing `chrome.storage.local` data, and keeps CMS payload fields separate from toolkit-only metadata.

### User Impact

- Users can manage snippets and saved widget skins from a richer library page and matching sidebar controls.
- Users can save Fancy Buttons into a categorized personal library, edit library-only details, export/import the library, and import buttons back into Graphic Links without leaking library metadata into CMS saves.
- Users can save and import Widget Manager option sets through a local browser library. Imports are intentionally create-first and do not overwrite exact-name matches.
- The extension popup exposes Option Set Importer next to the existing design tools, enabled only on Widget Manager pages.

### Safety Notes

- Option Set imports call `/DesignCenter/OptionSet/Add` first and then save to the returned option set ID. The importer does not guess the next ID.
- Option Set imports refuse exact-name matches under the same widget, so existing option sets are not silently overwritten.
- Option Set saves read the active/default IDs from Widget Manager DOM state instead of using the old hardcoded default option set ID pattern.
- Fancy Button library metadata lives under `cpToolkit` and is stripped before posting templates back to the CMS.
- Fancy Button library previews sanitize imported button text HTML, prevent `</style>` breakout from imported CSS, and restrict generated Google Font weights to numeric values.
- Saved skin source links are normalized to HTTP(S) URLs before rendering, so imported library JSON cannot create unsafe source links.
- Snippet and skin exports are versioned and still tolerate older library payloads.

### Validation

Run before commit:

```powershell
node --check js/shared/snippet-library-store.js
node --check js/shared/snippet-library-view.js
node --check js/tools/on-load/css-snippets.js
node --check js/snippets-page.js
node --check js/shared/fancy-button-library.js
node --check js/tools/on-load/cp-ImportFancyButton.js
node --check js/button-library-page.js
node --check js/tools/on-load/option-set-importer.js
node --check js/popup.js
node --check js/options.js
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('manifest.json','utf8')); JSON.parse(fs.readFileSync('data/on-load-tools.json','utf8')); console.log('json ok')"
git diff --check origin/main --
```

Manual QA before ready-for-review:

- Reload the unpacked extension after manifest changes.
- Open Theme Manager, verify the snippets sidebar search/filter/category controls, save a widget skin, and confirm it appears on the full Snippet Library page.
- Export and re-import snippets/skins using the versioned library payload.
- Open Graphic Links, verify built-in and saved Fancy Buttons, save a current button to the library with category/source metadata, and import it back into the CMS.
- Open Widget Manager, save the current option set to the local library, import it under a new name, and confirm a duplicate exact-name import is blocked.

## Full Change Inventory vs `origin/main`

### Documentation

- `README.md`
  - Adds local MV3 extension development setup.
  - Lists recently touched feature areas.
  - Documents syntax and JSON validation commands.
- `docs/snippet-skin-and-button-libraries.md`
  - Documents CSS snippet, saved skin, and Fancy Button library data contracts.
  - Covers storage keys, export payload shapes, metadata boundaries, manual QA, and validation.
- `docs/pr-main-diff-summary.md`
  - Captures this full PR scope and handoff checklist.

### Shared Library Helpers

- `js/shared/snippet-library-store.js`
  - Adds shared storage keys and normalizers for user snippets, copied skins, component snippets, and manual ordering.
  - Adds versioned import/export payload support for snippets and saved skins.
  - Centralizes backward-compatible normalization for older stored/exported shapes.
  - Normalizes saved skin source URLs to HTTP(S) before they can be rendered as links.
- `js/shared/snippet-library-view.js`
  - Adds shared query, filter, sort, category option, and category grouping helpers for snippets and saved skins.
- `js/shared/fancy-button-library.js`
  - Adds shared Fancy Button normalization, filtering, sorting, category/source metadata helpers, export parsing, and metadata stripping.
  - Keeps CMS fields like `categoryID` separate from toolkit library metadata.
  - Sanitizes preview-only button text HTML and style text used by imported/saved library previews.

### CSS Snippets and Saved Widget Skins

- `js/tools/on-load/css-snippets.js`
  - Integrates the shared snippet store/view helpers.
  - Adds sidebar search, filter, sort, category grouping, and saved skins tab behavior.
  - Adds saved skin capture/category metadata and versioned import/export covering snippets and skins.
  - Adds multi-component snippet handling for widget skin component CSS.
- `js/snippets-page.js`
  - Adds the Saved Skins tab to the full library page.
  - Adds search/filter/sort/category grouping for snippets and skins.
  - Adds multi-component snippet editing and richer snippet/skin cards.
- `html/snippets.html`
  - Adds Saved Skins tab, snippet search/filter controls, skin library toolbar, component snippet editor controls, and shared helper scripts.
- `css/snippets.css`
  - Styles the new toolbars, filter popovers, category sections, saved skin cards, component snippet editor, and responsive layouts.

### Fancy Button Library

- `js/tools/on-load/cp-ImportFancyButton.js`
  - Integrates the shared Fancy Button helper.
  - Adds categorized saved button library behavior inside the CMS flyout.
  - Adds save-to-library metadata prompts for category and source site.
  - Adds library import/export and image capture support for saved previews.
  - Preserves CMS category behavior when importing a saved template back into Graphic Links.
- `js/button-library-page.js`
  - Adds shared-helper-backed filtering, sorting, grouping, and metadata editing for saved buttons.
  - Adds category/source pills, grouped sections, details modal, and versioned library import/export behavior.
- `html/button-library.html`
  - Adds filter and category grouping controls.
  - Loads the shared Fancy Button helper before the page script.
- `css/button-library.css`
  - Styles filter popover, active controls, category sections, metadata pills, details modal, and responsive toolbar behavior.

### Widget Manager Option Sets

- `js/tools/on-load/option-set-importer.js`
  - Adds a Widget Manager-only Option Set Importer flyout.
  - Stores option set records in `chrome.storage.local` under `cp-toolkit-option-set-library`.
  - Saves the currently selected option set by serializing Widget Manager `.update[name]` fields into the CMS `saveJson` splitter payload.
  - Groups saved records by category, defaulting the category to the widget type name.
  - Imports by creating a new option set with `/DesignCenter/OptionSet/Add`, then posting saved settings to `/DesignCenter/Widgets/Save`.
  - Blocks exact-name matches for the same widget and supports JSON import/export of the local option set library.
- `data/on-load-tools.json`
  - Registers `option-set-importer` with help text describing Widget Manager-only usage and non-overwrite behavior.
- `js/options.js`
  - Adds Option Set Importer to the CSS & Design Tools settings category.
- `js/popup.js`
  - Adds Option Set Importer to the popup category.
  - Adds a side action button that is enabled only when the active tab is `/DesignCenter/Widgets/...` and the tool itself is enabled.
- `html/main.html`
  - Extends popup row styling to Option Set Importer.
  - Adds disabled side-button styling for tools that cannot open in the current context.
- `manifest.json`
  - Loads Option Set Importer as a content script.
  - Loads shared snippet and Fancy Button helpers before dependent content scripts.

### Miscellaneous

- `js/tools/on-demand/insertPoweredByHTML.js`
  - Simplifies the injected powered-by HTML style block.
  - Updates the inline CivicPlus SVG markup and path class assignment.

## Current Diff Status

Tracked modified files:

```text
css/button-library.css
css/snippets.css
data/on-load-tools.json
html/button-library.html
html/main.html
html/snippets.html
js/button-library-page.js
js/options.js
js/popup.js
js/snippets-page.js
js/tools/on-demand/insertPoweredByHTML.js
js/tools/on-load/cp-ImportFancyButton.js
js/tools/on-load/css-snippets.js
manifest.json
```

Untracked files to include if this full scope is intended:

```text
README.md
docs/pr-main-diff-summary.md
docs/snippet-skin-and-button-libraries.md
js/shared/fancy-button-library.js
js/shared/snippet-library-store.js
js/shared/snippet-library-view.js
js/tools/on-load/option-set-importer.js
```

## Recommended PR Steps From Here

1. Review this scope and confirm all listed files belong in one PR.
2. Run the validation commands above.
3. Stage explicit paths rather than using `git add -A` until the scope is confirmed.
4. Commit with a terse message such as `Add toolkit asset libraries`.
5. Push `codex/snippet-library-v2`.
6. Open a draft PR against `main` using the suggested title/body above.
