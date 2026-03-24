[CmdletBinding()]
param(
  [string]$Version = "",
  [switch]$AllowTagMove
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step {
  param([string]$Message)
  Write-Host "[release] $Message"
}

function Invoke-Git {
  param([string[]]$Args)
  & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') failed."
  }
}

function Get-GitText {
  param([string[]]$Args)
  $result = (& git @Args)
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') failed."
  }
  return [string]::Join("`n", $result).Trim()
}

function TryGet-GitText {
  param([string[]]$Args)
  $result = (& git @Args 2>$null)
  if ($LASTEXITCODE -ne 0) {
    return ""
  }
  return [string]::Join("`n", $result).Trim()
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
  if (-not (Test-Path ".git")) {
    throw "Not a git repository: $repoRoot"
  }

  $branch = Get-GitText @("branch", "--show-current")
  if ($branch -ne "main") {
    throw "Release must run from main. Current branch: $branch"
  }

  $dirty = Get-GitText @("status", "--porcelain")
  if (-not [string]::IsNullOrWhiteSpace($dirty)) {
    throw "Working tree is not clean. Commit or stash changes first."
  }

  $manifestPath = Join-Path $repoRoot "mv3-extension\manifest.json"
  if (-not (Test-Path $manifestPath)) {
    throw "Manifest not found: $manifestPath"
  }

  $manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
  $manifestVersion = [string]$manifest.version
  if (-not $manifestVersion -or $manifestVersion -notmatch '^\d+\.\d+\.\d+$') {
    throw "Manifest version must be semantic (x.y.z). Found: '$manifestVersion'"
  }

  if ([string]::IsNullOrWhiteSpace($Version)) {
    $Version = $manifestVersion
  } elseif ($Version -ne $manifestVersion) {
    throw "Version mismatch. Arg version '$Version' does not match manifest '$manifestVersion'."
  }

  $tag = "v$Version"
  Write-Step "Target version: $Version ($tag)"

  Write-Step "Fetching origin/main and tags..."
  Invoke-Git @("fetch", "origin", "main", "--tags")

  $ahead = [int](Get-GitText @("rev-list", "--count", "origin/main..HEAD"))
  $behind = [int](Get-GitText @("rev-list", "--count", "HEAD..origin/main"))

  if ($behind -gt 0) {
    throw "Local main is behind origin/main by $behind commit(s). Pull/reconcile first."
  }

  if ($ahead -gt 0) {
    Write-Step "Pushing $ahead local commit(s) on main..."
    Invoke-Git @("push", "origin", "main")
  } else {
    Write-Step "main already matches origin/main."
  }

  Invoke-Git @("fetch", "origin", "main", "--tags")
  $headSha = Get-GitText @("rev-parse", "HEAD")
  $originSha = Get-GitText @("rev-parse", "origin/main")
  if ($headSha -ne $originSha) {
    throw "After push/fetch, HEAD ($headSha) != origin/main ($originSha)."
  }

  $localTagTarget = TryGet-GitText @("rev-parse", "$tag^{}")
  $remoteTagLine = TryGet-GitText @("ls-remote", "--tags", "origin", "refs/tags/$tag^{}")
  $remoteTagTarget = ""
  if (-not [string]::IsNullOrWhiteSpace($remoteTagLine)) {
    $remoteTagTarget = ($remoteTagLine -split '\s+')[0].Trim()
  }

  $tagExists = (-not [string]::IsNullOrWhiteSpace($localTagTarget)) -or (-not [string]::IsNullOrWhiteSpace($remoteTagTarget))
  if ($tagExists -and -not $AllowTagMove) {
    throw "Tag $tag already exists. Bump manifest version or rerun with -AllowTagMove."
  }

  if ($tagExists -and $AllowTagMove) {
    Write-Step "Moving existing tag $tag to HEAD..."
    Invoke-Git @("tag", "-fa", $tag, "-m", "CivicPlus Toolkit $tag (retag)")
    Invoke-Git @("push", "origin", $tag, "--force")
  } else {
    Write-Step "Creating new tag $tag..."
    Invoke-Git @("tag", "-a", $tag, "-m", "CivicPlus Toolkit $tag")
    Invoke-Git @("push", "origin", $tag)
  }

  Write-Step "Release trigger submitted. Watch GitHub Actions: Package and Release."
}
finally {
  Pop-Location
}
