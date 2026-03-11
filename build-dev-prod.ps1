[CmdletBinding()]
param(
  [string]$RootPath = "",
  [string]$SourceFolder = "mv3-extension",
  [string]$DevFolder = "mv3-extension-dev",
  [string]$ProdFolder = "mv3-extension-prod"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Info {
  param([string]$Message)
  Write-Host "[build] $Message"
}

function Read-Text {
  param([string]$Path)
  return [System.IO.File]::ReadAllText($Path)
}

function Write-Utf8NoBom {
  param(
    [string]$Path,
    [string]$Text
  )
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

function Replace-Once {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Replacement,
    [string]$Label,
    [bool]$Optional = $false
  )
  $updated = [regex]::Replace($Content, $Pattern, $Replacement, 1)
  if (-not $Optional -and $updated -eq $Content) {
    throw "Pattern not found while stripping '$Label'."
  }
  return $updated
}

function Remove-IfExists {
  param([string]$Path)
  if (Test-Path $Path) {
    try {
      Remove-Item -Recurse -Force $Path
    }
    catch {
      cmd /c "rmdir /s /q `"$Path`"" | Out-Null
      if (Test-Path $Path) {
        throw
      }
    }
  }
}

function Remove-FileIfExists {
  param([string]$Path)
  if (Test-Path $Path) {
    Remove-Item -Force $Path
  }
}

function Copy-Tree {
  param(
    [string]$SourcePath,
    [string]$DestinationPath,
    [string[]]$ExtraExcludeDirs = @()
  )
  Remove-IfExists -Path $DestinationPath
  New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null

  $excludeDirs = @(".git", "server\node_modules")
  if ($ExtraExcludeDirs -and $ExtraExcludeDirs.Count -gt 0) {
    $excludeDirs += $ExtraExcludeDirs
  }

  $robocopyArgs = @(
    $SourcePath,
    $DestinationPath,
    "/E",
    "/R:1",
    "/W:1",
    "/NFL",
    "/NDL",
    "/NJH",
    "/NJS",
    "/XD"
  )
  $robocopyArgs += $excludeDirs

  & robocopy @robocopyArgs | Out-Null
  $code = $LASTEXITCODE
  if ($code -gt 7) {
    throw "Robocopy failed from '$SourcePath' to '$DestinationPath' (exit code $code)."
  }
}

function Invoke-NodeCheck {
  param([string]$FilePath)
  & node --check $FilePath
  if ($LASTEXITCODE -ne 0) {
    throw "node --check failed: $FilePath"
  }
}

function Strip-ProdBuild {
  param([string]$ProdPath)

  Write-Info "Stripping dev-only assets from prod build..."

  # Remove dev-only folders/files
  Remove-IfExists (Join-Path $ProdPath "js\content")
  Remove-IfExists (Join-Path $ProdPath "js\inject")
  Remove-IfExists (Join-Path $ProdPath "server")
  Remove-IfExists (Join-Path $ProdPath ".claude")
  Remove-FileIfExists (Join-Path $ProdPath "scrub.js")
  Remove-FileIfExists (Join-Path $ProdPath ".claudeignore")
  Remove-FileIfExists (Join-Path $ProdPath "CLAUDE.md")

  # manifest.json
  $manifestPath = Join-Path $ProdPath "manifest.json"
  $manifest = Read-Text $manifestPath
  $manifest = Replace-Once $manifest '(?m)^\s*"js/content/instrument-bridge\.js",\r?\n' "" "manifest content script bridge" $true
  Write-Utf8NoBom $manifestPath $manifest

  # html/main.html
  $mainHtmlPath = Join-Path $ProdPath "html\main.html"
  $mainHtml = Read-Text $mainHtmlPath
  $mainHtml = Replace-Once $mainHtml '(?ms)\s*\.capture-panel \{.*?\.capture-input \{.*?\}\s*' "" "popup capture CSS block" $true
  $mainHtml = Replace-Once $mainHtml '(?ms)\s*<div id="capture-panel" class="capture-panel">[\s\S]*?<div id="tools-container">' '<div id="tools-container">' "popup capture panel markup" $true
  Write-Utf8NoBom $mainHtmlPath $mainHtml

  # html/options.html
  $optionsHtmlPath = Join-Path $ProdPath "html\options.html"
  $optionsHtml = Read-Text $optionsHtmlPath
  $optionsHtml = Replace-Once $optionsHtml '(?ms)\s*\.mcp-row \{.*?\.mcp-inline-check input\[type="checkbox"\] \{.*?\}\s*' "" "options MCP CSS block" $true
  $optionsHtml = Replace-Once $optionsHtml '(?ms)\s*<div class="section">\s*<h2>MCP Capture Settings</h2>[\s\S]*?</div>\s*<div id="tools-container">' '<div id="tools-container">' "options MCP section" $true
  Write-Utf8NoBom $optionsHtmlPath $optionsHtml

  # js/popup.js
  $popupJsPath = Join-Path $ProdPath "js\popup.js"
  $popupJs = Read-Text $popupJsPath
  $popupJs = Replace-Once $popupJs '(?ms)\nlet captureStatus = \{[\s\S]*?const MCP_DEFAULT_ENDPOINT = ''http://localhost:9001/collect'';\r?\n' "`n" "popup MCP constants" $true
  $popupJs = Replace-Once $popupJs '(?ms)\nasync function getActiveTabId\(\) \{[\s\S]*?\n\}\n\n// Toggle tool enabled/disabled state' "`n// Toggle tool enabled/disabled state" "popup MCP functions block" $true
  $popupJs = Replace-Once $popupJs '(?ms)\ndocument\.getElementById\(''toggle-capture''\)\.addEventListener\(''click'',[\s\S]*?\n\}\);\n' "`n" "popup toggle listener" $true
  $popupJs = Replace-Once $popupJs '(?ms)\ndocument\.getElementById\(''export-capture''\)\.addEventListener\(''click'',[\s\S]*?\n\}\);\n' "`n" "popup export listener" $true
  $popupJs = Replace-Once $popupJs '(?ms)\ndocument\.getElementById\(''upload-capture''\)\.addEventListener\(''click'',[\s\S]*?\n\}\);\n' "`n" "popup upload listener" $true
  $popupJs = Replace-Once $popupJs '(?ms)\ndocument\.getElementById\(''mcp-endpoint''\)\.addEventListener\(''keydown'',[\s\S]*?\n\}\);\n' "`n" "popup endpoint listener" $true
  $popupJs = Replace-Once $popupJs '(?m)^\s*loadCaptureSettings\(\);\r?\n' "" "popup loadCaptureSettings call" $true
  $popupJs = Replace-Once $popupJs '(?m)^\s*refreshCaptureStatus\(\);\r?\n' "" "popup refreshCaptureStatus call" $true
  Write-Utf8NoBom $popupJsPath $popupJs

  # js/options.js
  $optionsJsPath = Join-Path $ProdPath "js\options.js"
  $optionsJs = Read-Text $optionsJsPath
  $optionsJs = Replace-Once $optionsJs '(?m)^const MCP_CAPTURE_.*\r?\n' "" "options MCP constants line" $true
  $optionsJs = Replace-Once $optionsJs '(?m)^\s*bindCaptureSettingsEvents\(\);\r?\n' "" "options bindCaptureSettingsEvents call" $true
  $optionsJs = Replace-Once $optionsJs '(?m)^\s*loadCaptureSettings\(\);\r?\n' "" "options loadCaptureSettings call" $true
  $optionsJs = Replace-Once $optionsJs '(?ms)function sanitizeMaxEvents\([\s\S]*?function saveCaptureSettings\(\) \{[\s\S]*?\n\}\n\n// ==================== ON-DEMAND TOOLS ====================' "// ==================== ON-DEMAND TOOLS ====================" "options MCP functions block" $true
  Write-Utf8NoBom $optionsJsPath $optionsJs

  # js/background/service-worker.js
  $swPath = Join-Path $ProdPath "js\background\service-worker.js"
  $sw = Read-Text $swPath
  $sw = Replace-Once $sw '(?ms)\nvar MCP_CAPTURE_KEY = ''mcp-capture-enabled'';[\s\S]*?\n// Prevent-timeout MAIN world function\.' "`n// Prevent-timeout MAIN world function." "service worker MCP globals block" $true
  $sw = Replace-Once $sw '(?ms)\nchrome\.tabs\.onRemoved\.addListener\([\s\S]*?\n\}\);\r?\n\r?\nloadCaptureConfig\(\);[\s\S]*?\n\}\);\r?\n\r?\n// Keep service worker alive \(MV3 best practice\)' "`n`n// Keep service worker alive (MV3 best practice)" "service worker MCP config listener block" $true
  $sw = Replace-Once $sw '(?ms)\n\s*if \(message && message\.action === ''cp-mcp-inject-instrumenter''[\s\S]*?return true;[^\n]*\n\s*}\r?\n' "`n" "service worker MCP inject action block" $true
  $sw = Replace-Once $sw '(?ms)\n\s*if \(message && message\.action === ''cp-mcp-bridge-ready''[\s\S]*?return true;[^\n]*\n\s*}\r?\n' "`n" "service worker MCP bridge action block" $true
  $sw = Replace-Once $sw '(?ms)\n\s*if \(message && message\.action === ''cp-mcp-capture-event''[\s\S]*?return true;[^\n]*\n\s*}\r?\n' "`n" "service worker MCP event action block" $true
  $sw = Replace-Once $sw '(?ms)\n\s*if \(message && message\.action === ''cp-mcp-capture-toggle''[\s\S]*?return true;[^\n]*\n\s*}\r?\n' "`n" "service worker MCP toggle action block" $true
  $sw = Replace-Once $sw '(?ms)\n\s*if \(message && message\.action === ''cp-mcp-capture-status''[\s\S]*?return true;[^\n]*\n\s*}\r?\n' "`n" "service worker MCP status action block" $true
  $sw = Replace-Once $sw '(?ms)\n\s*if \(message && message\.action === ''cp-mcp-capture-export''[\s\S]*?return true;[^\n]*\n\s*}\r?\n' "`n" "service worker MCP export action block" $true
  $sw = Replace-Once $sw '(?ms)\n\s*if \(message && message\.action === ''cp-mcp-capture-upload''[\s\S]*?return true;[^\n]*\n\s*}\r?\n' "`n" "service worker MCP upload action block" $true
  Write-Utf8NoBom $swPath $sw
}

try {
  if ([string]::IsNullOrWhiteSpace($RootPath)) {
    $RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
  }

  $sourcePath = Join-Path $RootPath $SourceFolder
  $devPath = Join-Path $RootPath $DevFolder
  $prodPath = Join-Path $RootPath $ProdFolder

  if (-not (Test-Path $sourcePath)) {
    throw "Source folder not found: $sourcePath"
  }

  Write-Info "Source: $sourcePath"
  Write-Info "Dev output: $devPath"
  Write-Info "Prod output: $prodPath"

  Write-Info "Copying source -> dev..."
  Copy-Tree -SourcePath $sourcePath -DestinationPath $devPath

  Write-Info "Copying source -> prod..."
  Copy-Tree -SourcePath $sourcePath -DestinationPath $prodPath -ExtraExcludeDirs @("server", ".claude")

  Strip-ProdBuild -ProdPath $prodPath

  # Basic validation
  $null = (Get-Content -Raw (Join-Path $devPath "manifest.json") | ConvertFrom-Json)
  $null = (Get-Content -Raw (Join-Path $prodPath "manifest.json") | ConvertFrom-Json)

  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node) {
    Invoke-NodeCheck (Join-Path $devPath "js\background\service-worker.js")
    Invoke-NodeCheck (Join-Path $devPath "js\popup.js")
    Invoke-NodeCheck (Join-Path $devPath "js\options.js")
    Invoke-NodeCheck (Join-Path $prodPath "js\background\service-worker.js")
    Invoke-NodeCheck (Join-Path $prodPath "js\popup.js")
    Invoke-NodeCheck (Join-Path $prodPath "js\options.js")
  }

  Write-Info "Build complete."
  Write-Info "Dev:  $devPath"
  Write-Info "Prod: $prodPath"
  exit 0
}
catch {
  Write-Error $_
  exit 1
}
