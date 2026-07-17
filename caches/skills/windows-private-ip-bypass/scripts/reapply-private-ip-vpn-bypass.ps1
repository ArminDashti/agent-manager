#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Re-applies private IP VPN bypass after a network reset or Mullvad reconnect.

.DESCRIPTION
    Runs the full bypass stack in one shot:
      1. Private IPv4 routes via the physical LAN gateway (RFC 1918, link-local, CGNAT)
      2. Company LAN routes and dpdc.local NRPT DNS (if company script exists)
      3. Optional scheduled-task install for persistence across reboots

    Run from an elevated PowerShell session after "Network reset", VPN reconnect,
    or when private traffic incorrectly routes through Mullvad (e.g. hop 1 = 10.128.0.1).

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File ".\reapply-private-ip-vpn-bypass.ps1"

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File ".\reapply-private-ip-vpn-bypass.ps1" -InstallTask
#>
param(
    [switch]$InstallTask,
    [switch]$SkipCompanyLan,
    [string]$TestHost = '10.10.12.52',
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

$SkillDir = Split-Path $PSScriptRoot -Parent
$DopagentScripts = Join-Path $env:USERPROFILE 'GitHub\dopagent\.cursor\skills\windows-private-ip-bypass\scripts'

function Resolve-BypassScript([string]$FileName) {
    $candidates = @(
        (Join-Path $PSScriptRoot $FileName),
        (Join-Path $DopagentScripts $FileName)
    )
    return $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

$PrivateRoutesScript = Resolve-BypassScript 'private-ip-bypass-routes.ps1'
$TaskInstallerScript = Resolve-BypassScript 'install-private-ip-bypass-task.ps1'
$CompanyLanScript = Join-Path $env:USERPROFILE 'scripts\company-lan-vpn-bypass.ps1'

function Write-Step([string]$Message) {
    Write-Host "[*] $Message" -ForegroundColor Cyan
}

function Invoke-ChildScript {
    param(
        [string]$Path,
        [string[]]$Arguments = @()
    )

    if (-not $Path -or -not (Test-Path $Path)) {
        Write-Warning "Skipping missing script: $Path"
        return
    }

    $argumentList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $Path) + $Arguments
    if ($WhatIf) {
        Write-Host "  would run: powershell $($argumentList -join ' ')"
        return
    }

    & powershell.exe @argumentList
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        throw "Script failed ($LASTEXITCODE): $Path"
    }
}

Write-Step 'Re-applying private IP VPN bypass'
Write-Host "  Skill dir: $SkillDir"
Write-Host ""

Write-Step 'Private IPv4 routes + Mullvad LAN sharing'
Invoke-ChildScript -Path $PrivateRoutesScript -Arguments @('-IncludeCgnat')

if (-not $SkipCompanyLan) {
    Write-Host ''
    Write-Step 'Company LAN routes + NRPT DNS'
    Invoke-ChildScript -Path $CompanyLanScript
}

if ($InstallTask) {
    Write-Host ''
    Write-Step 'Installing persistence scheduled task'
    Invoke-ChildScript -Path $TaskInstallerScript
}

if ($WhatIf) {
    Write-Host ''
    Write-Host 'WhatIf complete. No changes were made.' -ForegroundColor Yellow
    exit 0
}

Write-Host ''
Write-Step 'Verification'

$lanGateway = (
    Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
        Where-Object {
            $_.InterfaceAlias -notmatch 'Mullvad|VPN|OpenVPN|WireGuard|TAP|Tun' -and
            $_.NextHop -and $_.NextHop -ne '0.0.0.0'
        } |
        Sort-Object RouteMetric, ifMetric |
        Select-Object -First 1
).NextHop

Write-Host '  Private routes:'
route print -4 | Select-String '10\.0\.0\.0|10\.10\.0\.0|172\.16\.0\.0|192\.168\.0\.0|169\.254\.0\.0|100\.64\.0\.0|Persistent' | ForEach-Object {
    Write-Host "    $_"
}

$mullvadCli = @(
    "$env:ProgramFiles\Mullvad VPN\resources\mullvad.exe",
    "$env:ProgramFiles\Mullvad VPN\mullvad.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($mullvadCli) {
    $lanSetting = & $mullvadCli lan get 2>&1
    Write-Host "  Mullvad LAN sharing: $lanSetting"
}

if ($lanGateway) {
    $gatewayPing = ping -n 1 $lanGateway 2>&1 | Select-String 'Reply|timed out'
    Write-Host "  LAN gateway ($lanGateway): $gatewayPing"
}

try {
    $publicIp = (Invoke-WebRequest -Uri 'https://api.ipify.org' -UseBasicParsing -TimeoutSec 10).Content.Trim()
    Write-Host "  Public IP (should be VPN exit): $publicIp"
}
catch {
    Write-Warning "  Public IP check failed: $_"
}

if ($TestHost) {
    Write-Host "  Traceroute to $TestHost (hop 1 should be LAN gateway, not VPN):"
    tracert -d -h 2 $TestHost 2>&1 | Select-Object -First 6 | ForEach-Object { Write-Host "    $_" }
}

Write-Host ''
Write-Host 'Done. Private IP traffic should bypass the VPN tunnel.' -ForegroundColor Green
if (-not $InstallTask) {
    Write-Host 'Tip: add -InstallTask to register the logon/startup scheduled task.' -ForegroundColor Yellow
}
