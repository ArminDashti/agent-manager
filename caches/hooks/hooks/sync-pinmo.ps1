#Requires -Version 5.1
<#
.SYNOPSIS
  Cursor stop hook — rebuilds Pinmo and replaces the current install with the new build.
#>
$ErrorActionPreference = 'Stop'

function Stop-PinmoProcesses {
    $processNames = @('pinmo', 'Pinmo', 'Pinmo.Service', 'Pinmo.Api')
    foreach ($name in $processNames) {
        Get-Process -Name $name -ErrorAction SilentlyContinue |
            Stop-Process -Force -ErrorAction SilentlyContinue
    }

    Get-CimInstance Win32_Process |
        Where-Object {
            $_.ExecutablePath -and (
                $_.ExecutablePath -like '*\pinmo\*' -or
                $_.ExecutablePath -like '*\PinMo\*' -or
                $_.ExecutablePath -like "*$([Environment]::GetFolderPath('LocalApplicationData'))\Pinmo\*"
            )
        } |
        ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
}

function Sync-PinmoInstall {
    param(
        [Parameter(Mandatory = $true)][string]$SourceDir,
        [Parameter(Mandatory = $true)][string]$TargetDir
    )

    if (-not (Test-Path $SourceDir)) {
        throw "Build output not found: $SourceDir"
    }

    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }

    $robocopy = Get-Command robocopy -ErrorAction SilentlyContinue
    if ($robocopy) {
        & robocopy $SourceDir $TargetDir /MIR /R:2 /W:2 /NFL /NDL /NJH /NJS /NC /NS | Out-Null
        if ($LASTEXITCODE -ge 8) {
            throw "robocopy failed with exit code $LASTEXITCODE"
        }
        return
    }

    Copy-Item -Path (Join-Path $SourceDir '*') -Destination $TargetDir -Recurse -Force
}

$stdin = [Console]::In.ReadToEnd()
$payload = $null
if ($stdin) {
    try {
        $payload = $stdin | ConvertFrom-Json
    }
    catch {
        Write-Warning "[pinmo-hook] Could not parse hook JSON; continuing with export."
    }
}

$status = if ($payload -and $payload.status) { [string]$payload.status } else { 'completed' }
if ($status -ne 'completed') {
    Write-Host "[pinmo-hook] Agent status was '$status'; skipping export." -ForegroundColor DarkGray
    Write-Output '{}'
    exit 0
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$setupScript = Join-Path $projectRoot 'scripts\setup-pinmo-env.ps1'
$exportScript = Join-Path $projectRoot 'export.ps1'
$buildDir = Join-Path $projectRoot 'PinMo'
$installDir = [Environment]::GetEnvironmentVariable('PINMO_HOME', 'User')

if (-not $installDir) {
    if (-not (Test-Path $setupScript)) {
        Write-Error "setup-pinmo-env.ps1 not found at $setupScript"
        Write-Output '{}'
        exit 0
    }

    Write-Host '[pinmo-hook] PINMO_HOME is not set; running setup-pinmo-env.ps1...' -ForegroundColor Cyan
    & $setupScript
    $installDir = [Environment]::GetEnvironmentVariable('PINMO_HOME', 'User')
}

if (-not (Test-Path $exportScript)) {
    Write-Error "export.ps1 not found at $exportScript"
    Write-Output '{}'
    exit 0
}

Write-Host '[pinmo-hook] Stopping running Pinmo instances...' -ForegroundColor Cyan
Stop-PinmoProcesses
Start-Sleep -Seconds 1

Write-Host '[pinmo-hook] Building new version with export.ps1...' -ForegroundColor Cyan
& $exportScript
if ($LASTEXITCODE -ne 0) {
    Write-Warning "[pinmo-hook] export.ps1 exited with code $LASTEXITCODE."
    Write-Output '{}'
    exit 0
}

$cliExe = Join-Path $buildDir 'pinmo.exe'
if (-not (Test-Path $cliExe)) {
    Write-Warning "[pinmo-hook] pinmo.exe not found at $cliExe; skipping install sync."
    Write-Output '{}'
    exit 0
}

Write-Host "[pinmo-hook] Replacing current install at $installDir..." -ForegroundColor Cyan
try {
    Sync-PinmoInstall -SourceDir $buildDir -TargetDir $installDir
    Write-Host '[pinmo-hook] Current install updated. `pinmo` is ready in new PowerShell sessions.' -ForegroundColor Green
}
catch {
    Write-Warning "[pinmo-hook] Install sync failed: $($_.Exception.Message)"
}

Write-Output '{}'
exit 0
