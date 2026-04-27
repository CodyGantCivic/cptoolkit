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

  $excludeDirs = @(".git")
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
  Remove-IfExists (Join-Path $ProdPath "server")
  Remove-IfExists (Join-Path $ProdPath ".claude")
  Remove-FileIfExists (Join-Path $ProdPath ".claudeignore")
  Remove-FileIfExists (Join-Path $ProdPath "CLAUDE.md")
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
