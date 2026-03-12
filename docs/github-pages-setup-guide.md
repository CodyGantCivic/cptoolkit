# GitHub Pages Download Page — Setup Guide

This guide walks you through setting up the GitHub Pages download page and automated release workflow on your own fork of the toolkit.

## What You Get

- A download page at `https://<your-username>.github.io/<repo-name>/` where teammates can grab the latest extension ZIP
- A GitHub Actions workflow that automatically packages and publishes a new release whenever you push a version tag

## Files You Need

These files are already in the repo — you just need to update them for your fork:

```
docs/index.html              ← Landing page (update repo URLs)
docs/icon_128.png             ← Extension icon (no changes needed)
.github/workflows/release.yml ← Release workflow (update repo name if different)
```

## Step-by-Step Setup

### 1. Update `docs/index.html`

Find and replace these URLs with your own:

| Find | Replace with |
|------|-------------|
| `CodyGantCivic/MV3-Toolkit` | `<your-username>/<your-repo>` |
| `codygantcivic.github.io/MV3-Toolkit` | `<your-username>.github.io/<your-repo>` |

There are 3 places to update:
- The download button `href` (line with `releases/latest/download/mv3-toolkit.zip`)
- The GitHub API fetch URL (in the `<script>` at the bottom)
- The footer link to the GitHub repo

### 2. Update `js/popup.js` (update check)

Find these two lines near the top of the file:

```javascript
const GITHUB_REPO = 'CodyGantCivic/MV3-Toolkit';
const DOWNLOAD_PAGE = 'https://codygantcivic.github.io/MV3-Toolkit/';
```

Change them to point to your fork:

```javascript
const GITHUB_REPO = '<your-username>/<your-repo>';
const DOWNLOAD_PAGE = 'https://<your-username>.github.io/<your-repo>/';
```

### 3. Enable GitHub Pages

1. Go to your repo's **Settings** → **Pages**
   (`https://github.com/<your-username>/<your-repo>/settings/pages`)
2. Under **Source**, select **Deploy from a branch**
3. Set Branch to **main** and folder to **/docs**
4. Click **Save**

The page will be live in 1–2 minutes at `https://<your-username>.github.io/<your-repo>/`.

### 4. Create Your First Release

Tag your current version and push:

```bash
git tag v1.1.0
git push origin v1.1.0
```

This triggers the GitHub Actions workflow, which:
1. Packages the extension into `mv3-toolkit.zip`
2. Creates a GitHub Release with the ZIP attached

You can verify at `https://github.com/<your-username>/<your-repo>/releases`.

### 5. Verify

- [ ] Landing page loads at your GitHub Pages URL
- [ ] "Download Latest Version" button downloads the ZIP
- [ ] Version badge in the header shows your latest tag
- [ ] ZIP contains the extension files (manifest.json, js/, css/, etc.) and nothing extra

## Releasing Future Versions

1. Update `version` in `manifest.json`
2. Commit and push to main
3. Tag and push:
   ```bash
   git tag v1.2.0
   git push origin v1.2.0
   ```
4. The workflow handles the rest automatically

## For George (cp-vlasak/cptoolkit)

Your specific values:

| Setting | Value |
|---------|-------|
| GitHub repo | `cp-vlasak/cptoolkit` |
| Pages URL | `https://cp-vlasak.github.io/cptoolkit/` |
| Download URL | `https://github.com/cp-vlasak/cptoolkit/releases/latest/download/mv3-toolkit.zip` |
| Settings page | `https://github.com/cp-vlasak/cptoolkit/settings/pages` |
