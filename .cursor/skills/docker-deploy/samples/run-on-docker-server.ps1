<#
.SYNOPSIS
  Deploy stack to a remote host over SSH using sibling YAML only.

.DESCRIPTION
  Sample for .deploy/docker/run-on-docker-server.ps1.
  Reads run-on-docker-server.yaml — no CLI -- flags.
  Flow: build locally → docker save → SCP → remote docker load → sync_items → remote compose up -d.
  Never builds on the remote host.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$DeployDir = $PSScriptRoot
$RepoRoot = (Resolve-Path (Join-Path $DeployDir '../..')).Path
$ConfigPath = Join-Path $DeployDir 'run-on-docker-server.yaml'

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
run-on-docker-server.ps1 — remote Docker deploy (YAML-only)

USAGE:
  .\.deploy\docker\run-on-docker-server.ps1

CONFIG:
  Sibling file: run-on-docker-server.yaml

  stack_name          Compose project name (-p)
  image_tag           Image built locally and loaded remotely
  compose_file        Compose filename under .deploy/docker
  docker_network      External Docker network on remote
  api_publish_port    Host publish port; "" behind reverse proxy
  delete_volume       yes/true/1/y/on → remove volumes before up
  delete_image        yes/true/1/y/on → remove image during teardown
  ssh                 "ssh <alias>" or "host@user@password"
  ssh_key             Private key path (required for alias mode)
  remote_work_dir     Absolute remote directory for compose files
  sync_items          List of filenames under .deploy/docker to SCP

NOTES:
  - No CLI -- flags. Change behavior only via YAML.
  - Rejects placeholder ssh / ssh_key values at runtime.
  - Never prints the password segment of host@user@password.
  - Never builds on the remote host.
"@ -ForegroundColor Cyan
}

function Test-Truthy([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
    return $Value.Trim().ToLowerInvariant() -in @('yes', 'true', '1', 'y', 'on')
}

function Test-Placeholder([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return $true }
    return $Value -match '<[^>]+>'
}

function Read-DeployYaml([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing config: $Path"
    }
    $map = @{}
    $listKey = $null
    foreach ($raw in Get-Content -LiteralPath $Path) {
        $line = $raw
        $trim = $line.Trim()
        if ($trim -eq '' -or $trim.StartsWith('#')) { continue }

        if ($trim -match '^-\s+(?<item>.+)$' -and $listKey) {
            if ($null -eq $map[$listKey]) { $map[$listKey] = New-Object System.Collections.Generic.List[string] }
            $item = $Matches['item'].Trim()
            if (($item.StartsWith('"') -and $item.EndsWith('"')) -or ($item.StartsWith("'") -and $item.EndsWith("'"))) {
                $item = $item.Substring(1, $item.Length - 2)
            }
            [void]$map[$listKey].Add($item)
            continue
        }

        if ($trim -match '^(?<key>[^:#]+):\s*(?<val>.*)$') {
            $key = $Matches['key'].Trim()
            $val = $Matches['val'].Trim()
            if ($val -eq '') {
                $listKey = $key
                $map[$key] = New-Object System.Collections.Generic.List[string]
                continue
            }
            $listKey = $null
            if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
                $val = $val.Substring(1, $val.Length - 2)
            }
            $map[$key] = $val
        }
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

function Parse-SshTarget([string]$SshValue, [string]$SshKey) {
    $value = $SshValue.Trim()
    if ($value -match '^(?i)ssh\s+(?<alias>\S+)$') {
        $alias = $Matches['alias']
        if (Test-Placeholder $SshKey) {
            throw 'ssh_key is required for alias mode. Set a real private key path in run-on-docker-server.yaml.'
        }
        if (-not (Test-Path -LiteralPath $SshKey)) {
            throw "ssh_key file not found: $SshKey"
        }
        return @{
            Mode      = 'alias'
            Alias     = $alias
            KeyPath   = $SshKey
            LogTarget = "ssh $alias"
        }
    }

    $parts = $value.Split('@')
    if ($parts.Count -eq 3) {
        $hostName = $parts[0]
        $userName = $parts[1]
        $password = $parts[2]
        if ((Test-Placeholder $hostName) -or (Test-Placeholder $userName) -or [string]::IsNullOrWhiteSpace($password)) {
            throw 'ssh password mode still has placeholders. Fill host@user@password in YAML.'
        }
        return @{
            Mode      = 'password'
            Host      = $hostName
            User      = $userName
            Password  = $password
            LogTarget = "$userName@$hostName"
        }
    }

    throw 'ssh must be "ssh <alias>" or "host@user@password".'
}

function Invoke-Remote {
    param($Target, [string]$RemoteCommand)

    if ($Target.Mode -eq 'alias') {
        & ssh -i $Target.KeyPath -o BatchMode=yes $Target.Alias $RemoteCommand
        if ($LASTEXITCODE -ne 0) { throw "Remote command failed on $($Target.LogTarget)" }
        return
    }

    if (-not (Get-Command sshpass -ErrorAction SilentlyContinue)) {
        throw 'Password mode requires sshpass on PATH (or switch YAML to ssh alias + ssh_key).'
    }
    $env:SSHPASS = $Target.Password
    try {
        & sshpass -e ssh -o StrictHostKeyChecking=accept-new "$($Target.User)@$($Target.Host)" $RemoteCommand
        if ($LASTEXITCODE -ne 0) { throw "Remote command failed on $($Target.LogTarget)" }
    }
    finally {
        Remove-Item Env:SSHPASS -ErrorAction SilentlyContinue
    }
}

function Copy-ToRemote {
    param($Target, [string]$LocalPath, [string]$RemotePath)

    if ($Target.Mode -eq 'alias') {
        & scp -i $Target.KeyPath -o BatchMode=yes $LocalPath "$($Target.Alias):$RemotePath"
        if ($LASTEXITCODE -ne 0) { throw "SCP failed to $($Target.LogTarget):$RemotePath" }
        return
    }

    if (-not (Get-Command sshpass -ErrorAction SilentlyContinue)) {
        throw 'Password mode requires sshpass on PATH (or switch YAML to ssh alias + ssh_key).'
    }
    $env:SSHPASS = $Target.Password
    try {
        & sshpass -e scp -o StrictHostKeyChecking=accept-new $LocalPath "$($Target.User)@$($Target.Host):$RemotePath"
        if ($LASTEXITCODE -ne 0) { throw "SCP failed to $($Target.LogTarget):$RemotePath" }
    }
    finally {
        Remove-Item Env:SSHPASS -ErrorAction SilentlyContinue
    }
}

if ($args.Count -gt 0) {
    Write-Fail 'This script accepts no CLI arguments. Edit run-on-docker-server.yaml instead.'
    Show-Help
    exit 1
}

try {
    Ensure-Docker
    $cfg = Read-DeployYaml $ConfigPath
    $stackName = Require-Key $cfg 'stack_name'
    $imageTag = Require-Key $cfg 'image_tag'
    $composeFile = Require-Key $cfg 'compose_file'
    $network = Require-Key $cfg 'docker_network'
    $publishPort = if ($cfg.ContainsKey('api_publish_port')) { [string]$cfg['api_publish_port'] } else { '' }
    $deleteVolume = Test-Truthy ($(if ($cfg.ContainsKey('delete_volume')) { [string]$cfg['delete_volume'] } else { 'no' }))
    $deleteImage = Test-Truthy ($(if ($cfg.ContainsKey('delete_image')) { [string]$cfg['delete_image'] } else { 'no' }))
    $sshValue = Require-Key $cfg 'ssh'
    $sshKey = if ($cfg.ContainsKey('ssh_key')) { [string]$cfg['ssh_key'] } else { '' }
    $remoteWorkDir = Require-Key $cfg 'remote_work_dir'

    if (Test-Placeholder $sshValue) {
        throw 'ssh still has placeholders. Fill run-on-docker-server.yaml before server deploy.'
    }
    if (Test-Placeholder $remoteWorkDir) {
        throw 'remote_work_dir still has placeholders. Fill a real absolute remote path.'
    }

    $syncItems = @()
    if ($cfg.ContainsKey('sync_items') -and $cfg['sync_items'] -is [System.Collections.IEnumerable] -and $cfg['sync_items'] -isnot [string]) {
        $syncItems = @($cfg['sync_items'] | ForEach-Object { [string]$_ })
    }
    if ($syncItems.Count -eq 0) {
        $syncItems = @($composeFile)
    }

    $composePath = Join-Path $DeployDir $composeFile
    $dockerfile = Join-Path $DeployDir 'Dockerfile'
    if (-not (Test-Path -LiteralPath $composePath)) { throw "Compose file not found: $composePath" }
    if (-not (Test-Path -LiteralPath $dockerfile)) { throw "Dockerfile not found: $dockerfile" }

    $target = Parse-SshTarget -SshValue $sshValue -SshKey $sshKey
    Write-Step "Remote target: $($target.LogTarget)"
    Write-Step "Stack=$stackName image=$imageTag workdir=$remoteWorkDir"

    Write-Step "Building $imageTag locally (context=$RepoRoot)"
    docker build -f $dockerfile -t $imageTag $RepoRoot
    if ($LASTEXITCODE -ne 0) { throw 'docker build failed' }
    Write-Ok "Built $imageTag"

    $tarName = ($imageTag -replace '[:/]', '_') + '.tar'
    $tarPath = Join-Path $env:TEMP $tarName
    Write-Step "Saving image to $tarPath"
    docker save -o $tarPath $imageTag
    if ($LASTEXITCODE -ne 0) { throw 'docker save failed' }

    $remoteTar = "/tmp/$tarName"
    Write-Step "Uploading image to $($target.LogTarget)"
    Copy-ToRemote -Target $target -LocalPath $tarPath -RemotePath $remoteTar
    Invoke-Remote -Target $target -RemoteCommand "docker load -i $remoteTar && rm -f $remoteTar"
    Write-Ok 'Image loaded on remote'
    Remove-Item -LiteralPath $tarPath -Force -ErrorAction SilentlyContinue

    Write-Step "Ensuring remote work dir $remoteWorkDir"
    Invoke-Remote -Target $target -RemoteCommand "mkdir -p '$remoteWorkDir'"

    foreach ($item in $syncItems) {
        $localItem = Join-Path $DeployDir $item
        if (-not (Test-Path -LiteralPath $localItem)) { throw "sync_items entry not found: $localItem" }
        $remoteItem = "$remoteWorkDir/$item"
        Write-Step "Sync $item"
        Copy-ToRemote -Target $target -LocalPath $localItem -RemotePath $remoteItem
    }

    $remoteCompose = "$remoteWorkDir/$composeFile"
    $downFlags = if ($deleteVolume) { '-v' } else { '' }

    if ($deleteVolume -or $deleteImage) {
        Write-Step 'Remote compose down'
        Invoke-Remote -Target $target -RemoteCommand "docker compose -p '$stackName' -f '$remoteCompose' --project-directory '$remoteWorkDir' down $downFlags"
    }

    if ($deleteImage) {
        Write-Step "Removing remote image $imageTag"
        Invoke-Remote -Target $target -RemoteCommand "docker image rm -f '$imageTag' || true"
    }

    Write-Step "Ensuring remote network $network"
    Invoke-Remote -Target $target -RemoteCommand "docker network inspect '$network' >/dev/null 2>&1 || docker network create '$network'"

    Write-Step 'Remote compose up -d (no remote build)'
    $exportPrefix = "IMAGE_TAG='$imageTag' DOCKER_NETWORK='$network' API_PUBLISH_PORT='$publishPort'"
    Invoke-Remote -Target $target -RemoteCommand "$exportPrefix docker compose -p '$stackName' -f '$remoteCompose' --project-directory '$remoteWorkDir' up -d"
    Write-Ok "Stack deployed at $remoteWorkDir on $($target.LogTarget)"
}
catch {
    Write-Fail $_.Exception.Message
    Show-Help
    exit 1
}
