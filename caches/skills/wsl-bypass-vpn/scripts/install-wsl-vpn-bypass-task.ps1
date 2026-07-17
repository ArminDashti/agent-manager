# Registers a logon + startup task that keeps WSL NAT traffic off VPN tunnels.
# Run once in an elevated PowerShell session.

$ErrorActionPreference = 'Stop'

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error 'Run this script from an elevated PowerShell session.'
}

$skillScript = Join-Path $PSScriptRoot 'wsl-bypass-vpn.ps1'
$scriptPath = Join-Path $env:USERPROFILE 'scripts\wsl-bypass-vpn.ps1'

if (-not (Test-Path $skillScript)) {
    Write-Error "Missing skill script: $skillScript"
}

$targetDir = Split-Path $scriptPath
if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
Copy-Item $skillScript $scriptPath -Force

$taskName = 'WSL Bypass VPN Routes'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$triggerNetwork = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType InteractiveToken -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($triggerLogon, $triggerNetwork) -Settings $settings -Principal $principal -Force | Out-Null
& $scriptPath
Write-Host "Installed scheduled task '$taskName' and applied routes."
