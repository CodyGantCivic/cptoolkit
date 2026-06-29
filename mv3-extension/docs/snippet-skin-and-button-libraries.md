# Snippet, Skin, and Fancy Button Libraries

This document covers the shared library work added for CSS snippets, saved widget skins, and Fancy Button templates. It is intended for developers maintaining the extension, not end-user help text.

## Goals

- Keep sidebar/flyout and full-page library behavior consistent.
- Centralize storage normalization, filtering, sorting, and grouping logic.
- Preserve backward compatibility for existing local `chrome.storage.local` data.
- Avoid storing CMS-only or library-only metadata in the wrong place when importing back into the CMS.

## CSS Snippets and Saved Skins

### Surfaces

- CMS sidebar/flyout: `js/tools/on-load/css-snippets.js`
- Full extension page: `html/snippets.html`, `js/snippets-page.js`, `css/snippets.css`
- Shared storage helpers: `js/shared/snippet-library-store.js`
- Shared view helpers: `js/shared/snippet-library-view.js`

### Storage Keys

- `cp-toolkit-user-snippets`: user-created snippets.
- `cp-toolkit-copied-skins`: saved/copied widget skins.
- `cp-toolkit-snippet-order`: manual snippet ordering.

The shared store normalizes older snippet and skin shapes. When adding fields, prefer extending the normalizers in `snippet-library-store.js` instead of patching one surface only.

### Export Shape

Snippet exports use versioned data. Version 2 supports both snippets and saved skins:

```json
{
  "type": "cp-toolkit-library",
  "version": 2,
  "snippets": {},
  "skins": {}
}
```

Keep imports tolerant of old payloads. Internal teammates may have older exports from before saved skins were included.

### View Rules

Filtering, category grouping, and sorting should go through `CPToolkitSnippetLibraryView` where possible. The sidebar and full page should not each reimplement query/category/sort behavior.

Saved skins and snippets intentionally share similar controls:

- Search
- Funnel filter popover
- Category filter
- Sort selector
- Optional category grouping/accordion layout

### Component Snippets

Multi-component snippets store component CSS by component ID. Component labels and code extraction are normalized in `snippet-library-store.js`.

When adding a new widget component:

1. Add it to `COMPONENT_TYPES` in `js/shared/snippet-library-store.js`.
2. Make sure both the sidebar modal and full-page editor can select and render it.
3. Confirm import/export preserves the component object shape.

## Fancy Button Library

### Surfaces

- CMS Graphic Links flyout: `js/tools/on-load/cp-ImportFancyButton.js`
- Full extension page: `html/button-library.html`, `js/button-library-page.js`, `css/button-library.css`
- Shared library helpers: `js/shared/fancy-button-library.js`
- Built-in templates: `data/fancy-button-library.json`

### Storage Keys

- `cp-customButtonLibrary`: saved custom button templates.
- `cp-darkBgToggles`: preview background preference by `custom:{key}` or `builtin:{key}`.
- `cp-pendingFancyExport`: temporary export workflow state while navigating to a Graphic Link edit page.
- `cp-pendingCategoryReturn`: temporary state used to return to the previous Graphic Link category after export.

### Library Metadata

Library-only metadata lives under `cpToolkit` on each saved button:

```json
{
  "styles": [],
  "buttonText": "Pay Online",
  "categoryID": "0",
  "cpToolkit": {
    "category": "Payments",
    "sourceSite": "example.civicplus.com",
    "savedAt": "2026-06-25T00:00:00.000Z",
    "updatedAt": "2026-06-25T00:00:00.000Z"
  }
}
```

`categoryID` is the CMS Graphic Links category. `cpToolkit.category` is only for organizing the toolkit library. Do not mix these two meanings.

Use `CPToolkitFancyButtonLibrary.setMetadata()` when saving or updating library details. Use `stripLibraryMetadata()` before posting a template back to `/GraphicLinks/GraphicLinkSave`.

### Export Shape

Fancy Button library exports are versioned:

```json
{
  "type": "cp-toolkit-fancy-button-library",
  "version": 2,
  "buttons": {}
}
```

Version 2 preserves `cpToolkit` metadata. Imports still accept older wrapped exports and raw `{ key: button }` objects.

### Preview and Asset Notes

The preview builder renders HTML/CSS from the saved Fancy Button JSON. It does not need the original Graphic Link record to still exist.

Images are more fragile. `Save to Library` attempts to copy referenced image URLs into `savedImages`, and previews resolve those local copies first. Future work should make this fully offline by:

1. Scanning every CSS image reference on save/import.
2. Storing large assets outside `chrome.storage.local` if needed, likely IndexedDB.
3. Keeping a generated preview snapshot as a fallback when CSS or assets fail.
4. Showing asset status in the UI so teammates know whether a saved button is portable.

### Category Workflow

Saved buttons can be categorized by button type, source site, campaign, or any internal taxonomy. Existing buttons without metadata normalize to `Uncategorized`. Built-in templates normalize to `Built-in Templates`.

When editing category behavior:

1. Change helper behavior in `js/shared/fancy-button-library.js`.
2. Confirm the full page and CMS flyout still use the shared helper.
3. Confirm saved button imports normalize metadata.
4. Confirm CMS imports strip library-only metadata.

## Manifest Loading

The shared scripts must load before their dependent content scripts:

- `js/shared/snippet-library-store.js`
- `js/shared/snippet-library-view.js`
- `js/tools/on-load/css-snippets.js`
- `js/shared/fancy-button-library.js`
- `js/tools/on-load/cp-ImportFancyButton.js`

Extension pages load shared scripts directly in their HTML files.

## Manual QA Checklist

CSS snippets and saved skins:

1. Open Theme Manager and open the CSS snippets sidebar.
2. Create a snippet with a custom category.
3. Verify search, filter, sort, and category folders in the sidebar.
4. Open the full Snippet Library page.
5. Verify Snippets and Saved Skins tabs have matching controls.
6. Export and re-import the library.

Fancy Buttons:

1. Open `/Admin/GraphicLinks.aspx`.
2. Open the Import Item flyout.
3. Verify the Template Library tab shows category accordions.
4. Search and filter by type/category/source.
5. Export an existing Fancy Button and save it to the library with a category and source site.
6. Open the full Fancy Button Library page.
7. Verify the saved button appears with category/source pills and editable Details.
8. Import a saved button back into the CMS and verify the CMS `categoryID` is still taken from the current Graphic Links category.

## Validation Commands

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
