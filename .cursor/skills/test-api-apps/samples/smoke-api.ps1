<#
.SYNOPSIS
  Minimal HTTP smoke test for a deployed API.

.DESCRIPTION
  Sample for test-api-apps. Polls a health path, then optional GET paths.
  Use when the project has no integration test runner.
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [string]$HealthPath = '/health',

    [string[]]$GetPaths = @(),

    [int]$TimeoutSec = 60,

    [int]$IntervalSec = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
    Write-Host ">> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "OK  $Message" -ForegroundColor Green
}

function Write-Fail([string]$Message) {
    Write-Host "ERR $Message" -ForegroundColor Red
}

function Invoke-ApiGet([string]$Url) {
    return Invoke-WebRequest -Uri $Url -Method Get -UseBasicParsing -TimeoutSec 15
}

$base = $BaseUrl.TrimEnd('/')
$healthUrl = "$base$HealthPath"
$deadline = (Get-Date).AddSeconds($TimeoutSec)
$ready = $false

Write-Step "Polling $healthUrl (timeout ${TimeoutSec}s)"

while ((Get-Date) -lt $deadline) {
    try {
        $resp = Invoke-ApiGet $healthUrl
        if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
            Write-Ok "Health $($resp.StatusCode) at $healthUrl"
            $ready = $true
            break
        }
        Write-Step "Health returned $($resp.StatusCode); retrying..."
    }
    catch {
        Write-Step "Not ready: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds $IntervalSec
}

if (-not $ready) {
    Write-Fail "Health check failed within ${TimeoutSec}s"
    exit 1
}

$failed = 0
foreach ($path in $GetPaths) {
    $url = "$base$path"
    Write-Step "GET $url"
    try {
        $resp = Invoke-ApiGet $url
        if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
            Write-Ok "$path → $($resp.StatusCode)"
        }
        else {
            Write-Fail "$path → $($resp.StatusCode)"
            $failed++
        }
    }
    catch {
        Write-Fail "$path → $($_.Exception.Message)"
        $failed++
    }
}

if ($failed -gt 0) {
    Write-Fail "$failed additional check(s) failed"
    exit 1
}

Write-Ok 'Smoke test passed'
exit 0
