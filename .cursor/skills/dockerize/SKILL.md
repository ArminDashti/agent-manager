---
name: dockerize
description: Creates or edits create-image.ps1, run-on-docker-local.ps1, and run-on-docker-server.ps1 for this repo, then deploys locally or over SSH.
Uses /cloud-admin remote paths and compose VOLUME_DIR bind-mounts. Requires user clarification before any deploy.
Use when the user asks to run, build, or deploy in Docker, prepare a Docker stack, or mentions these scripts.
---

# Prepare for Docker

## Overview

- **Primary output:** create or edit these repo-root scripts:
  - `create-image.ps1`
  - `run-on-docker-local.ps1`
  - `run-on-docker-server.ps1`
- **Do not** recreate a single `run-on-docker.ps1`; that layout is obsolete here.
- Deploy only via the run scripts; build via `create-image.ps1`.
- **Mandatory discovery first:** clarify with the user and inspect Docker state before build/deploy/delete.
- Keep project compose/Dockerfile logic; refresh flags, defaults, help, and paths to match this skill.
- Related: `create-powershell-script` for `--flag=value`, `Show-Help`, progress/color.

## Objectives

1. Ensure all three scripts match the contracts below (create or edit in place).
2. Keep `docker-compose.yml` bind-mounting `${VOLUME_DIR}` → `/data`.
3. Keep `.docker/stack.manifest.json` in sync with stack/network/volume/work-dir defaults.
4. Gather connection, port, volume, and image choices before acting.
5. Run the matching script with the user's flags; report endpoints and paths.

## Workflow

### Step 1: Create or edit scripts + compose + manifest

| File | Role |
|------|------|
| `create-image.ps1` | Build/tag image from `Dockerfile` |
| `run-on-docker-local.ps1` | Build + compose up on local Docker |
| `run-on-docker-server.ps1` | Local build, transfer image, remote compose up (no remote build) |
| `docker-compose.yml` | Must bind-mount `${VOLUME_DIR:-/cloud-admin/docker-volumes/<CONTAINER-NAME>}` → `/data` |
| `.docker/stack.manifest.json` | `stackName`, `containerName`, `dockerNetwork`, `remoteWorkDir`, `volumeDir`, `volumeName`, image/port defaults |

#### Parameter contract (null → resolve at runtime)

| Flag | Default | Local null → | Server null → |
|------|---------|--------------|---------------|
| `--ssh-string` | `null` | Local daemon (reject non-local) | **Required** SSH config alias |
| `--delete-image` | `null` | `no` | `no` |
| `--delete-volume` | `null` | `no` | `no` |
| `--internal-port` | `null` | Random free `30000–32767` | Same when publishing; `80` for sslh domain routing |
| `--volume-dir` | `null` | `<USERPROFILE>/docker/<CONTAINER-NAME>` | `/cloud-admin/docker-volumes/<CONTAINER-NAME>` |
| `--volume-name` | `null` | `<CONTAINER-NAME>-volume` | `<CONTAINER-NAME>-volume` |
| `--network-name` | `null` | Manifest `dockerNetwork` or `<CONTAINER-NAME>-network` | Same |
| `--api-base-url` | `null` | `.env` or `http://localhost:8080/dogan/api/v1` | Same |
| `--help` | — | Show help; exit | Show help; exit |

Server-only extras (when used): `--domain`, `--reverse-proxy`, `--public-port`.

#### Remote path rules (server)

| Path | Default | Notes |
|------|---------|-------|
| Compose install (work dir) | `/cloud-admin/docker/<CONTAINER-NAME>` | From manifest `remoteWorkDir`; `sudo mkdir -p` + `chown` to SSH user before `scp` |
| Volume bind-mount | `/cloud-admin/docker-volumes/<CONTAINER-NAME>` | `sudo mkdir -p`; pass as `VOLUME_DIR` to compose |
| Domain TLS (sslh) | `<volume-dir>/tls` | Sidecar certs; not the web `/data` tree |

**Never** use `/opt/docker/...` for this project.

`Invoke-RemoteShell` wraps commands in `bash -lc '...'` (no `$()` expansion). For `chown $(whoami)`, call `ssh` with a double-quoted remote command instead.

#### Placeholder resolution

| Placeholder | Resolve from |
|-------------|--------------|
| `<CONTAINER-NAME>` | Compose `container_name`, manifest `containerName` / `stackName`, or repo folder |
| Local volume user path | `$env:USERPROFILE` / `$env:HOME` |
| Safe port | Free port in `30000–32767` (`Get-NetTCPConnection` / `netstat`) |

#### `--help` (every script)

1. Usage  
2. Flags (null + resolved meaning)  
3. ≥3 examples  
4. Notes: SSH alias rule, truthy yes/no, safe ports, remote `/cloud-admin` paths (server)

Test with `--help` after edits; ask before a full deploy.

### Step 2: Clarify with the user (before deploy)

**Do not build, deploy, or delete until the user answers.**

| Topic | Ask |
|-------|-----|
| **Target** | Local or server script? |
| **Connection** | SSH alias only (never include `ssh`) |
| **Images** | After Step 3: keep or `--delete-image=yes`? |
| **Volumes** | After Step 3: keep or `--delete-volume=yes`? |
| **Port** | Random `30000–32767` or fixed? |
| **Volume dir** | Defaults above, or custom? |
| **API URL** | Default API base or `--api-base-url`? |
| **Remote extras** | Domain / reverse-proxy if server? |
| **Destructive** | Confirm delete flags and remote deploy |

### Step 3: Inspect Docker state

```powershell
docker images --format "{{.Repository}}:{{.Tag}}" | Select-String -Pattern "<stack-or-container-name>"
docker volume ls
docker ps -a --filter "name=<container-name>"
```

Remote (after alias):

```powershell
ssh <alias> "docker images; docker volume ls; docker ps -a; ls -la /cloud-admin/docker /cloud-admin/docker-volumes 2>/dev/null"
```

Show findings, then ask keep vs delete.

### Step 4: Map answers → run

| Choice | Command / flag |
|--------|----------------|
| Local | `.\run-on-docker-local.ps1` |
| Server | `.\run-on-docker-server.ps1 --ssh-string=<alias>` |
| Delete images/volumes | `--delete-image=yes` / `--delete-volume=yes` |
| Port / volume / network / API | `--internal-port=` / `--volume-dir=` / `--network-name=` / `--api-base-url=` |

Truthy: `yes`, `true`, `1`, `y`, `on`.

### Step 5: Run

From repo root:

```powershell
.\create-image.ps1
.\run-on-docker-local.ps1 [--flags]
.\run-on-docker-server.ps1 --ssh-string=<alias> [--flags]
```

### Step 6: Verify and report

Report URL/port, `VOLUME_DIR`, remote work dir (if server), network, image tag, cleanup. On failure, read script output (help prints on validation errors).

## Safety rules

1. **Never** build/deploy/delete before Step 2 and Step 3.
2. **Never** put `ssh` inside `--ssh-string`.
3. **Never** use `--delete-image=yes` or `--delete-volume=yes` without explicit confirmation.
4. **Never** recreate unified `run-on-docker.ps1` for this repo.
5. **Never** use `/opt/docker` as the remote install path; use `/cloud-admin/docker/<CONTAINER-NAME>`.
6. **Always** default server `--volume-dir` to `/cloud-admin/docker-volumes/<CONTAINER-NAME>` and create it with `sudo`.
7. **Always** bind-mount `VOLUME_DIR` → `/data` in `docker-compose.yml`.
8. **Always** pass `VOLUME_DIR` from both run scripts into compose.
9. **Always** implement `--help` on all three scripts.
10. **Always** show existing images/volumes before keep-vs-delete.
11. **Always** run scripts from the directory that contains them.

## Key facts & reference

### This repo defaults

| Item | Value |
|------|-------|
| Container / stack | `parkiroid-web` |
| Image | `parkiroid-web:latest` |
| Network | `parkiroid-net` (external) |
| Local volume dir | `<USERPROFILE>/docker/parkiroid-web` |
| Server volume dir | `/cloud-admin/docker-volumes/parkiroid-web` |
| Server work dir | `/cloud-admin/docker/parkiroid-web` |
| Compose mount | `${VOLUME_DIR}` → `/data` |
| Safe ports | `30000–32767` |

### Manifest keys

| Key | Example |
|-----|---------|
| `remoteWorkDir` | `/cloud-admin/docker/parkiroid-web` |
| `volumeDir` | `/cloud-admin/docker-volumes/parkiroid-web` |
| `volumeName` | `parkiroid-web-volume` |
| `dockerNetwork` | `parkiroid-net` |

### Troubleshooting

| Symptom | Check |
|---------|-------|
| `mkdir` under `/cloud-admin` fails | Passwordless `sudo` for SSH user; script must `sudo mkdir` + `chown` |
| `scp` permission denied | Work dir ownership after `chown $(whoami)` |
| Missing compose/Dockerfile | Run from repo root |
| Port in use | Re-pick `30000–32767` or pass `--internal-port` |
| Old `/opt/docker` paths | Refresh server script + manifest to `/cloud-admin/docker/...` |
