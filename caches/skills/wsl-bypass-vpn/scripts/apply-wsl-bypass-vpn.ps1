# Apply mirrored-mode WSL VPN bypass for one distro (default: WSL default distro).
# No elevation required. Run from repo root or any directory.

param(
    [string]$Distro = '',
    [switch]$SkipShutdown
)

$ErrorActionPreference = 'Stop'

function Get-DefaultWslDistroName {
    $raw = wsl -l -v 2>$null
    foreach ($line in $raw) {
        $clean = ($line -replace '[^\x20-\x7E\*]', '').Trim()
        if ($clean -match '^\*\s+(\S+)') {
            return $Matches[1]
        }
    }

    $first = wsl -l -q 2>$null | Select-Object -First 1
    if ($first) {
        return $first.Trim()
    }

    throw 'No WSL distro found.'
}

function Write-WslConfig {
    $path = Join-Path $env:USERPROFILE '.wslconfig'
    $content = @"
[wsl2]
networkingMode=mirrored
dnsTunneling=false
"@
    [System.IO.File]::WriteAllText($path, $content)
    Write-Host "Wrote $path (mirrored mode)"
}

function Install-LfScriptCopy {
    param(
        [string]$Source,
        [string]$Dest
    )

    $content = Get-Content -Raw $Source
    $content = $content -replace "`r`n", "`n"
    $destDir = Split-Path $Dest -Parent
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($Dest, $content)
}

$skillScripts = $PSScriptRoot
$skillRoot = Split-Path $skillScripts -Parent
$debianScript = Join-Path $skillScripts 'wsl-bypass-vpn-debian.sh'
$serviceFile = Join-Path $skillScripts 'wsl-bypass-vpn.service'
$timerFile = Join-Path $skillScripts 'wsl-bypass-vpn.timer'

foreach ($required in @($debianScript, $serviceFile, $timerFile)) {
    if (-not (Test-Path $required)) {
        throw "Missing skill file: $required"
    }
}

if (-not $Distro) {
    $Distro = Get-DefaultWslDistroName
}

Write-Host "Target distro: $Distro"

Write-WslConfig

$userScript = Join-Path $env:USERPROFILE 'scripts\wsl-bypass-vpn-debian.sh'
Install-LfScriptCopy -Source $debianScript -Dest $userScript
Write-Host "Prepared LF script at $userScript"

if (-not $SkipShutdown) {
    Write-Host 'Shutting down WSL...'
    wsl --shutdown | Out-Null
    Start-Sleep -Seconds 8
}

$wslUser = $env:USERNAME
$winScript = "/mnt/c/Users/$wslUser/scripts/wsl-bypass-vpn-debian.sh"
$driveLetter = $skillScripts.Substring(0, 1).ToLower()
$winSkill = "/mnt/$driveLetter" + ($skillScripts.Substring(2) -replace '\\', '/')

# Write LF install script — PowerShell here-strings inject CRLF and break bash.
$installScript = @"
#!/bin/bash
set -euo pipefail
install -m 755 '$winScript' /usr/local/bin/wsl-bypass-vpn.sh
rm -f /etc/default/wsl-bypass-vpn
cp '$winSkill/wsl-bypass-vpn.service' /etc/systemd/system/
cp '$winSkill/wsl-bypass-vpn.timer' /etc/systemd/system/
if ! grep -q '^systemd=true' /etc/wsl.conf 2>/dev/null; then
  mkdir -p /etc
  if [ -f /etc/wsl.conf ]; then
    if ! grep -q '^\[boot\]' /etc/wsl.conf; then
      printf '\n[boot]\nsystemd=true\n' >> /etc/wsl.conf
    elif ! grep -q '^systemd=true' /etc/wsl.conf; then
      sed -i '/^\[boot\]/a systemd=true' /etc/wsl.conf
    fi
  else
    printf '[boot]\nsystemd=true\n' > /etc/wsl.conf
  fi
fi
systemctl daemon-reload
systemctl enable --now wsl-bypass-vpn.service
systemctl enable --now wsl-bypass-vpn.timer
"@
$installScript = $installScript -replace "`r`n", "`n"
$installPath = Join-Path $env:USERPROFILE 'scripts\wsl-bypass-vpn-install.sh'
[System.IO.File]::WriteAllText($installPath, $installScript)

$winInstall = "/mnt/c/Users/$wslUser/scripts/wsl-bypass-vpn-install.sh"
wsl -d $Distro -u root -- bash $winInstall

Write-Host ''
Write-Host 'Verification:'
wsl -d $Distro -- wslinfo --networking-mode
wsl -d $Distro -- ip -4 route | Select-String '^default'
$wslIp = wsl -d $Distro -- curl -s --max-time 15 https://api.ipify.org
$winIp = (Invoke-WebRequest -Uri 'https://api.ipify.org' -UseBasicParsing -TimeoutSec 15).Content
Write-Host "WSL public IP:     $wslIp"
Write-Host "Windows public IP: $winIp"

if ($wslIp -eq $winIp) {
    Write-Warning 'WSL and Windows share the same public IP — bypass may not be working.'
    exit 1
}

Write-Host 'Bypass applied: WSL egress uses LAN, Windows may still use VPN.'
