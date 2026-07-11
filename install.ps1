#Requires -Version 5.1
<#
.SYNOPSIS
    Cleans the release folder and rebuilds the portable Windows app.

.DESCRIPTION
    Removes all content from release/ and runs npm run dist to export
    Janus.exe into that directory.

.EXAMPLE
    .\install.ps1

.EXAMPLE
    .\install.ps1 --ShowHelp
#>

[CmdletBinding()]
param(
    [switch]$ShowHelp
)

$ErrorActionPreference = 'Stop'

$RepoRoot = $PSScriptRoot
$ReleaseDir = Join-Path $RepoRoot 'release'

function Show-Help {
    Write-Host ''
    Write-Host 'install.ps1' -ForegroundColor Cyan
    Write-Host '  Cleans release/ and rebuilds the portable Windows app.' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host 'Usage:' -ForegroundColor Yellow
    Write-Host '  .\install.ps1'
    Write-Host '  .\install.ps1 --ShowHelp'
    Write-Host ''
    Write-Host 'Steps:' -ForegroundColor Yellow
    Write-Host '  1. Check prerequisites (npm, package.json)'
    Write-Host '  2. Install npm dependencies (npm install)'
    Write-Host '  3. Remove all files and folders in release/'
    Write-Host '  4. Run npm run dist (electron-vite build + electron-builder)'
    Write-Host ''
    Write-Host 'Output:' -ForegroundColor Yellow
    Write-Host "  $ReleaseDir\Janus.exe"
    Write-Host ''
}

if ($ShowHelp) {
    Show-Help
    exit 0
}

function Write-Step {
    param(
        [int]$Step,
        [int]$Total,
        [string]$Message
    )

    $percent = [int](($Step / $Total) * 100)
    Write-Progress -Activity 'Janus install' -Status $Message -PercentComplete $percent
    Write-Host "[$Step/$Total] $Message" -ForegroundColor Cyan
}

$totalSteps = 4

Write-Step -Step 1 -Total $totalSteps -Message 'Checking prerequisites'

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host 'Error: npm was not found. Install Node.js and ensure npm is on PATH.' -ForegroundColor Red
    Show-Help
    exit 1
}

if (-not (Test-Path (Join-Path $RepoRoot 'package.json'))) {
    Write-Host "Error: package.json not found in $RepoRoot" -ForegroundColor Red
    exit 1
}

Write-Step -Step 2 -Total $totalSteps -Message 'Installing npm dependencies (npm install)'

Push-Location $RepoRoot
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

Write-Step -Step 3 -Total $totalSteps -Message "Cleaning $ReleaseDir"

if (Test-Path $ReleaseDir) {
    Get-ChildItem -Path $ReleaseDir -Force | Remove-Item -Recurse -Force
    Write-Host '  Release folder cleared.' -ForegroundColor DarkGray
}
else {
    New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null
    Write-Host '  Release folder created.' -ForegroundColor DarkGray
}

Write-Step -Step 4 -Total $totalSteps -Message 'Building and exporting app (npm run dist)'

Push-Location $RepoRoot
try {
    npm run dist
    if ($LASTEXITCODE -ne 0) {
        throw "npm run dist failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

Write-Progress -Activity 'Janus install' -Completed

$exePath = Join-Path $ReleaseDir 'Janus.exe'
if (Test-Path $exePath) {
    Write-Host ''
    Write-Host 'Build completed successfully.' -ForegroundColor Green
    Write-Host "  $exePath" -ForegroundColor Green
}
else {
    Write-Host ''
    Write-Host 'Build finished, but Janus.exe was not found in release/.' -ForegroundColor Yellow
    Write-Host "  Check contents of: $ReleaseDir" -ForegroundColor Yellow
    exit 1
}
