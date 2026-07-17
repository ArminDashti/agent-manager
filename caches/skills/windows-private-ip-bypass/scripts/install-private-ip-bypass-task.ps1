# Registers a logon + startup task that re-applies private IP bypass routes.
# Run once in an elevated PowerShell session.

$ErrorActionPreference = 'Stop'

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error 'Run this script from an elevated PowerShell session.'
}

$skillScript = Join-Path $PSScriptRoot 'private-ip-bypass-routes.ps1'
$scriptPath = Join-Path $env:USERPROFILE 'scripts\private-ip-bypass-routes.ps1'

if (-not (Test-Path $skillScript)) {
    Write-Error "Missing skill script: $skillScript"
}

$targetDir = Split-Path $scriptPath
if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
Copy-Item $skillScript $scriptPath -Force

$taskName = 'Private IP VPN Bypass Routes'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -IncludeCgnat -ExcludeWifiDirectRanges"
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$triggerStartup = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType InteractiveToken -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($triggerLogon, $triggerStartup) -Settings $settings -Principal $principal -Force | Out-Null
& $scriptPath -IncludeCgnat -ExcludeWifiDirectRanges
Write-Host "Installed scheduled task '$taskName' and applied routes."
