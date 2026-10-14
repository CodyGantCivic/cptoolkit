# Fancy Button ID Badge and Advanced Styles Selector Copy Buttons

This document covers two additions to `graphic-link-advanced-style-helper.js`
on the Graphic Links Fancy Button Builder. It is intended for developers
maintaining the extension, not end-user help text (that lives in
`data/on-load-tools.json`).

## What this adds

1. **Fancy Button ID badge** — a pill next to the "Fancy Button Builder"
   modal title showing the button's real `.fancyButtonN` class (or
   "unsaved" if it hasn't been saved yet), so the number is visible without
   opening DevTools.
2. **Selector copy buttons** — a small `⧉` button next to every Advanced
   Styles selector line (Background outer/inner, Default Text Style, and
   every added Text Style, for both the Normal and Hover state) that copies
   a ready-to-paste starting selector to the clipboard, e.g.:

   ```
   }

   .fancyButton1:is(:hover, :focus, :active) .textStyle2,
   .fancyButton1556:is(:hover, :focus, :active) .textStyle2 {
   ```

   Both the builder's placeholder class (`fancyButton1`) and the button's
   real saved class are included, so the pasted rule works whether it's
   previewed in the builder or after Insert/Save rewrites the placeholder.

## DOM discoveries (none of this is documented anywhere else)

- The Advanced Styles content for a level is **not** the panel named by the
  `#selectedTab` dropdown's option value. That panel only holds
  Background & Border / Spacing & Sizing fields. Advanced Styles lives in a
  separate, sibling "Misc" panel:
  - `#fancyButtonOuterBackgroundMisc`
  - `#fancyButtonInnerBackgroundMisc`
  - `#fancyButtonTextStyleMisc` — Default Text Style only
  - `#fancyButtonTextStyleMisc{N}` — each added Text Style gets **its own**
    numbered Misc panel (confirmed by direct `getBoundingClientRect()` +
    computed `display` measurement). An earlier version of this code
    assumed all Text Styles shared one `#fancyButtonTextStyleMisc`
    container; that container is real but belongs only to Default Text
    Style, and stays in the DOM (hidden) once a numbered style exists —
    which is why buttons injected into it were never visible.
- Within a Misc panel, each selector header (`p.cpExpandCollapseControl`)
  has its native content box (`div.cpExpandCollapseBox`, holding the
  textarea) as its **direct next DOM sibling**. The native expand/collapse
  toggle depends on that exact adjacency. Never insert anything between
  them.
- The header's own toggle click appears to be handled in a way (capture
  phase and/or a `mousedown`-driven handler) that fires before a listener
  on a *descendant* of the header could call `stopPropagation()` to stop
  it. A button appended inside the header toggles the row on every click.
  The fix: insert the button as a **preceding sibling** of the header
  (never a descendant, never disturbing the header→box adjacency), then use
  `flexbox` `order` on the shared parent to visually place it after the
  header text. CSS `order` only changes paint order, never
  `nextElementSibling` — confirmed live: the toggle still works when the
  header itself is clicked, and clicking the button never toggles it.
  - An earlier attempt used `display:inline-block` on the header to get it
    onto the same line as a following sibling button. That introduced a
    large gap above the content box — a known inline-block whitespace
    quirk. The flex + `order` approach has no such issue.
- **"Add New Text Style" clones the previous panel's entire DOM subtree**,
  including an already-injected copy button. A markup clone carries over
  attributes (so a stale `data-cp-base` on the cloned button survives) but
  never carries over JS-attached event listeners. This has two
  consequences for anything added to these panels:
  1. Never store per-button state only in a JS closure. `injectSelectorCopyButtons()`
     must always overwrite `data-cp-base` / `data-cp-hover` on whatever
     wrapper it finds (fresh or cloned), not skip re-checking just because
     a wrapper already exists.
  2. Never bind click/hover listeners directly to an individual button.
     Both `click` and hover (`mouseover`/`mouseout`, not
     `mouseenter`/`mouseleave` — those don't bubble and can't be delegated)
     are handled by **one delegated listener bound once to the modal**
     (`getVisibleFancyButtonModal()`), which reads target state fresh from
     the clicked/hovered element's data attributes every time. A listener
     bound to one specific button node is silently gone the moment the CMS
     clones that node away.
- A previous Fancy Button Builder modal instance can be left in the DOM
  (hidden) when reopened without a full page reload. Any lookup that
  assumes there is only one `#selectedTab` or one modal in the whole
  document can silently grab a stale instance. `getVisibleFancyButtonModal()`
  scopes every lookup (`#selectedTab`, the Misc panels, the modal title) to
  the modal whose `offsetParent !== null`.

## Toolbar copy button and "Update selectors" button (2026-10-14)

3. **Copy selector toolbar button** — a button in the Mini IDE toolbar
   (`.css-copy-selector`, `mini-ide.js`) for Fancy Button style boxes and for
   widget-skin `MiscellaneousStyles` boxes. It asks whichever helper owns the
   textarea for a snippet via `getSelectorCopySnippetForTextarea(textarea)`:
   - `graphicLinkHelper` reuses the base and hover state already stored on the
     per-panel copy icon beside the box, so both buttons always agree.
   - `widgetSkinHelper` finds the CMS label above the box (either `.x {` in one
     node, or the selector and a lone `{` in separate nodes), takes the nearest
     one and never crosses another textarea, then prefixes `.widget.skinN`.
     `.widget` itself becomes `.widget.skinN`; anything else becomes a
     descendant. State (`:hover`, `:active`) comes from the label text.
4. **Update selectors button** (`.cpFancyButtonConvertBtn`) — beside the ID
   badge. Green outline when every rule has both `.fancyButton1` and the real
   ID, red when a rule is missing one half, neutral when it cannot check
   (unsaved button, or Mini IDE off). It uses
   `CPToolkit.portable.cssNeedsPortableConversion`, which counts a rule as
   needing conversion only if one twin is missing, and
   `transformCssPortable(css, id, true)` to add just the missing half. The
   plain Make Portable transform would re-emit already-dual rules in a
   different order, so it is not used to decide state. Nothing is saved until
   the user saves the button.

## Maintenance notes

- If you add another per-button interactive affordance to these panels,
  route it through the same delegated-listener pattern, not a per-element
  listener — it will otherwise break the first time a user adds a new Text
  Style.
- The button/tooltip styles use `!important` on nearly every property. This
  is required: this page has a generic `button, input[type=button] { width:
  41px !important; ... }` reset that will otherwise win.
- `docs/toolkit-activation-reliability-plan.md`-style regression concerns
  don't apply here — this feature only reads the DOM and writes to the
  clipboard; it never rewrites persisted textarea values.
