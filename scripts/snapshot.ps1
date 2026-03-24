[CmdletBinding()]
param(
  [string]$ArchiveRoot = "",
  [switch]$CreateGitTag
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step {
  param([string]$Message)
  Write-Host "[snapshot] $Message"
}

function Get-GitText {
  param([string[]]$Args)
  $result = (& git @Args)
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') failed."
  }
  return [string]::Join("`n", $result).Trim()
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
  if (-not (Test-Path ".git")) {
    throw "Not a git repository: $repoRoot"
  }

  $manifestPath = Join-Path $repoRoot "mv3-extension\manifest.json"
  if (-not (Test-Path $manifestPath)) {
    throw "Manifest not found: $manifestPath"
  }

  $manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
  $version = [string]$manifest.version
  if (-not $version) {
    $version = "unknown"
  }

  $branch = Get-GitText @("branch", "--show-current")
  $sha = Get-GitText @("rev-parse", "--short", "HEAD")
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

  if ([string]::IsNullOrWhiteSpace($ArchiveRoot)) {
    $ArchiveRoot = Join-Path (Split-Path -Parent $repoRoot) "Archive"
  }

  if (-not (Test-Path $ArchiveRoot)) {
    New-Item -ItemType Directory -Path $ArchiveRoot -Force | Out-Null
  }

  $snapshotName = "snapshot-v$version-$timestamp-$sha"
  $snapshotPath = Join-Path $ArchiveRoot $snapshotName
  New-Item -ItemType Directory -Path $snapshotPath -Force | Out-Null

  $sourceFolder = Join-Path $repoRoot "mv3-extension"
  $targetFolder = Join-Path $snapshotPath "mv3-extension"
  Copy-Item -Path $sourceFolder -Destination $targetFolder -Recurse -Force

  $metaPath = Join-Path $snapshotPath "SNAPSHOT.txt"
  @(
    "Snapshot: $snapshotName"
    "Created: $(Get-Date -Format o)"
    "Repo: $repoRoot"
    "Branch: $branch"
    "Commit: $sha"
    "Version: $version"
  ) | Set-Content -Path $metaPath -Encoding UTF8

  $zipPath = Join-Path $ArchiveRoot "$snapshotName.zip"
  if (Test-Path $zipPath) {
    Remove-Item -Force $zipPath
  }
  Compress-Archive -Path (Join-Path $snapshotPath "*") -DestinationPath $zipPath -CompressionLevel Fastest

  if ($CreateGitTag) {
    $tag = "backup/$timestamp-v$version"
    & git tag -a $tag -m "Backup snapshot $tag"
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to create git tag: $tag"
    }
    Write-Step "Created git tag: $tag"
  }

  Write-Step "Snapshot folder: $snapshotPath"
  Write-Step "Snapshot zip: $zipPath"
}
finally {
  Pop-Location
}
