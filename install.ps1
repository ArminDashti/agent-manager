#Requires -Version 5.1
<#
.SYNOPSIS
    Builds the portable Windows app and deploys Janus to an install directory.

.DESCRIPTION
    Cleans release/, runs npm run dist, keeps only Janus.exe and settings.json
    in release/, then deploys the full portable layout to -Dir (default: project root).

.PARAMETER Dir
    Install destination directory. Defaults to the project root ($PSScriptRoot).

.EXAMPLE
    .\install.ps1

.EXAMPLE
    .\install.ps1 -Dir C:\Janus

.EXAMPLE
    .\install.ps1 --ShowHelp
#>

[CmdletBinding()]
param(
    [string]$Dir = $PSScriptRoot,
    [switch]$ShowHelp
)

$ErrorActionPreference = 'Stop'

$RepoRoot = $PSScriptRoot
$ReleaseDir = Join-Path $RepoRoot 'release'

$InstallDirs = @(
    'caches/skills',
    'caches/hooks',
    'caches/rules',
    'caches/agents',
    'mcps'
)

function Show-Help {
    Write-Host ''
    Write-Host 'install.ps1' -ForegroundColor Cyan
    Write-Host '  Builds the portable app and deploys Janus to an install directory.' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host 'Usage:' -ForegroundColor Yellow
    Write-Host '  .\install.ps1'
    Write-Host '  .\install.ps1 -Dir C:\Janus'
    Write-Host '  .\install.ps1 --ShowHelp'
    Write-Host ''
    Write-Host 'Parameters:' -ForegroundColor Yellow
    Write-Host "  -Dir    Install destination (default: $RepoRoot)"
    Write-Host ''
    Write-Host 'Steps:' -ForegroundColor Yellow
    Write-Host '  1. Check prerequisites (npm, package.json)'
    Write-Host '  2. Install npm dependencies (npm install)'
    Write-Host '  3. Remove all files and folders in release/'
    Write-Host '  4. Run npm run dist (electron-vite build + electron-builder)'
    Write-Host '  5. Clean release/ to Janus.exe + settings.json only'
    Write-Host '  6. Deploy to install directory with folder skeleton'
    Write-Host ''
    Write-Host 'Build output:' -ForegroundColor Yellow
    Write-Host "  $ReleaseDir\Janus.exe"
    Write-Host "  $ReleaseDir\settings.json"
    Write-Host ''
    Write-Host 'Install layout:' -ForegroundColor Yellow
    Write-Host '  Janus.exe, settings.json, caches/skills, caches/hooks, caches/rules, caches/agents, mcps/'
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

function Ensure-InstallSkeleton {
    param([string]$TargetRoot)

    foreach ($rel in $InstallDirs) {
        $full = Join-Path $TargetRoot $rel
        if (-not (Test-Path $full)) {
            New-Item -ItemType Directory -Path $full -Force | Out-Null
        }
    }
}

function Deploy-Release {
    param(
        [string]$SourceDir,
        [string]$TargetDir
    )

    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }

    $exeSrc = Join-Path $SourceDir 'Janus.exe'
    $settingsSrc = Join-Path $SourceDir 'settings.json'
    $settingsDest = Join-Path $TargetDir 'settings.json'

    Copy-Item -Path $exeSrc -Destination (Join-Path $TargetDir 'Janus.exe') -Force

    if (-not (Test-Path $settingsDest)) {
        Copy-Item -Path $settingsSrc -Destination $settingsDest -Force
        Write-Host '  settings.json copied (new install).' -ForegroundColor DarkGray
    }
    else {
        Write-Host '  settings.json already exists; left unchanged.' -ForegroundColor DarkGray
    }

    Ensure-InstallSkeleton -TargetRoot $TargetDir
}

$totalSteps = 6

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

Write-Step -Step 5 -Total $totalSteps -Message 'Cleaning release/ to Janus.exe and settings.json only'

$exePath = Join-Path $ReleaseDir 'Janus.exe'
$settingsPath = Join-Path $ReleaseDir 'settings.json'

if (-not (Test-Path $exePath)) {
    Write-Host ''
    Write-Host 'Build finished, but Janus.exe was not found in release/.' -ForegroundColor Yellow
    Write-Host "  Check contents of: $ReleaseDir" -ForegroundColor Yellow
    exit 1
}

$keep = @('Janus.exe', 'settings.json')
Get-ChildItem -Path $ReleaseDir -Force | Where-Object { $keep -notcontains $_.Name } | Remove-Item -Recurse -Force

if (-not (Test-Path $settingsPath)) {
    $template = Join-Path $RepoRoot 'resources\settings.template.json'
    if (Test-Path $template) {
        Copy-Item -Path $template -Destination $settingsPath -Force
        Write-Host '  settings.json created from template.' -ForegroundColor DarkGray
    }
}

Write-Step -Step 6 -Total $totalSteps -Message "Deploying to $Dir"

$installDir = [System.IO.Path]::GetFullPath($Dir)
Deploy-Release -SourceDir $ReleaseDir -TargetDir $installDir

Write-Progress -Activity 'Janus install' -Completed

Write-Host ''
Write-Host 'Install completed successfully.' -ForegroundColor Green
Write-Host "  Build:   $exePath" -ForegroundColor Green
Write-Host "  Install: $installDir" -ForegroundColor Green
Write-Host '  Layout:  Janus.exe, settings.json, caches/*, mcps/' -ForegroundColor Green
