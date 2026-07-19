<#
.SYNOPSIS
  Deploy stack on the local Docker daemon using sibling YAML only.

.DESCRIPTION
  Sample for .deploy/docker/run-on-docker-local.ps1.
  Reads run-on-docker-local.yaml — no CLI -- flags.
  Build context = repo root; Dockerfile = .deploy/docker/Dockerfile.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$DeployDir = $PSScriptRoot
$RepoRoot = (Resolve-Path (Join-Path $DeployDir '../..')).Path
$ConfigPath = Join-Path $DeployDir 'run-on-docker-local.yaml'

function Write-Step([string]$Message) {
    Write-Host ">> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "OK  $Message" -ForegroundColor Green
}

function Write-Fail([string]$Message) {
    Write-Host "ERR $Message" -ForegroundColor Red
}

function Show-Help {
    Write-Host @"
run-on-docker-local.ps1 — local Docker deploy (YAML-only)

USAGE:
  .\.deploy\docker\run-on-docker-local.ps1

CONFIG:
  Sibling file: run-on-docker-local.yaml

  stack_name          Compose project name (-p)
  image_tag           Image built and run
  compose_file        Compose filename under .deploy/docker
  docker_network      External Docker network (created if missing)
  api_publish_port    Host publish port; "" behind reverse proxy
  delete_volume       yes/true/1/y/on → remove volumes before up
  delete_image        yes/true/1/y/on → remove image during teardown

NOTES:
  - No CLI -- flags. Change behavior only via YAML.
  - Builds: docker build -f .deploy/docker/Dockerfile <repo-root>
  - Compose uses pre-built image: (scripts own the build).
"@ -ForegroundColor Cyan
}

function Test-Truthy([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
    return $Value.Trim().ToLowerInvariant() -in @('yes', 'true', '1', 'y', 'on')
}

function Read-FlatYaml([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing config: $Path"
    }
    $map = @{}
    foreach ($raw in Get-Content -LiteralPath $Path) {
        $line = $raw.Trim()
        if ($line -eq '' -or $line.StartsWith('#')) { continue }
        if ($line -match '^\s*-') { continue }
        if ($line -notmatch '^(?<key>[^:#]+):\s*(?<val>.*)$') { continue }
        $key = $Matches['key'].Trim()
        $val = $Matches['val'].Trim()
        if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        $map[$key] = $val
    }
    return $map
}

function Require-Key($Map, [string]$Key) {
    if (-not $Map.ContainsKey($Key) -or [string]::IsNullOrWhiteSpace([string]$Map[$Key])) {
        throw "YAML missing required key: $Key"
    }
    return [string]$Map[$Key]
}

function Ensure-Docker {
    docker version *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Docker CLI is not available. Start Docker Desktop / daemon.' }
}

function Ensure-Network([string]$Name) {
    docker network inspect $Name *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Step "Creating network $Name"
        docker network create $Name | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Failed to create network: $Name" }
    }
    Write-Ok "Network $Name"
}

if ($args.Count -gt 0) {
    Write-Fail 'This script accepts no CLI arguments. Edit run-on-docker-local.yaml instead.'
    Show-Help
    exit 1
}

try {
    Ensure-Docker
    $cfg = Read-FlatYaml $ConfigPath
    $stackName = Require-Key $cfg 'stack_name'
    $imageTag = Require-Key $cfg 'image_tag'
    $composeFile = Require-Key $cfg 'compose_file'
    $network = Require-Key $cfg 'docker_network'
    $publishPort = if ($cfg.ContainsKey('api_publish_port')) { [string]$cfg['api_publish_port'] } else { '' }
    $deleteVolume = Test-Truthy ($(if ($cfg.ContainsKey('delete_volume')) { $cfg['delete_volume'] } else { 'no' }))
    $deleteImage = Test-Truthy ($(if ($cfg.ContainsKey('delete_image')) { $cfg['delete_image'] } else { 'no' }))

    $composePath = Join-Path $DeployDir $composeFile
    $dockerfile = Join-Path $DeployDir 'Dockerfile'
    if (-not (Test-Path -LiteralPath $composePath)) { throw "Compose file not found: $composePath" }
    if (-not (Test-Path -LiteralPath $dockerfile)) { throw "Dockerfile not found: $dockerfile" }

    $env:API_PUBLISH_PORT = $publishPort
    $env:IMAGE_TAG = $imageTag
    $env:DOCKER_NETWORK = $network

    Write-Step "Stack=$stackName image=$imageTag port='$publishPort'"

    if ($deleteVolume) {
        Write-Step 'Stopping stack and removing volumes'
        docker compose -p $stackName -f $composePath --project-directory $RepoRoot down -v
    }
    elseif ($deleteImage) {
        Write-Step 'Stopping stack'
        docker compose -p $stackName -f $composePath --project-directory $RepoRoot down
    }

    if ($deleteImage) {
        Write-Step "Removing image $imageTag"
        docker image rm -f $imageTag 2>$null | Out-Null
    }

    Write-Step "Building $imageTag (context=$RepoRoot)"
    docker build -f $dockerfile -t $imageTag $RepoRoot
    if ($LASTEXITCODE -ne 0) { throw 'docker build failed' }
    Write-Ok "Built $imageTag"

    Ensure-Network $network

    Write-Step 'Compose up -d'
    docker compose -p $stackName -f $composePath --project-directory $RepoRoot up -d
    if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed' }

    if ($publishPort) {
        Write-Ok "Local endpoint: http://localhost:$publishPort"
    }
    else {
        Write-Ok 'Stack is up (no host publish port; reverse-proxy mode).'
    }
}
catch {
    Write-Fail $_.Exception.Message
    Show-Help
    exit 1
}
