---
name: prepare-for-docker
description: >-
  Builds and deploys Docker stacks locally or over SSH using run-on-docker.ps1.
  Creates or edits run-on-docker.ps1 with project defaults. Requires user
  clarification on connection, ports, volumes, and images before any deploy.
  Use when the user asks to run, build, or deploy in Docker, prepare a Docker
  stack, start a compose stack, deploy over SSH, or mentions run-on-docker.ps1.
---

# Prepare for Docker

## Overview

- **Primary output:** create or edit `run-on-docker.ps1` in the target project (repo root by default).
- Deploy any Docker stack via that script — local or remote over SSH.
- **Mandatory discovery first:** ask the user required questions and inspect existing Docker state before running any script or command.
- Exclusions: do not reimplement Docker steps manually; only edit `run-on-docker.ps1` when creating, updating defaults, or when the user asks.

## Objectives

1. Create or update `run-on-docker.ps1` with the default parameter values below.
2. Gather connection, port, volume, and image choices from the user before acting.
3. Inspect existing images and volumes tied to the target container/stack.
4. Run `run-on-docker.ps1` with flags that match the user's answers.
5. Report endpoints, paths, and any cleanup performed.

## Workflow

### Step 1: Create or edit `run-on-docker.ps1`

When the project has no script or defaults need refreshing, create or edit `run-on-docker.ps1` at the target path.

**Default parameter values** (bake into the script or its default block):

| Flag | Default |
|------|---------|
| `--ssh-string` | `localhost` |
| `--delete-image` | `no` |
| `--delete-volume` | `no` |
| `--internal-port` | random pick from safe ports range |
| `--volume-dir` | `/<USER-PROFILE-NAME>/docker/<CONTAINER-NAME>` |
| `--volume-name` | `<CONTAINER-NAME>-volume` |
| `--network-name` | `<CONTAINER-NAME>-net` |

**Placeholder resolution:**

| Placeholder | Resolve from |
|-------------|--------------|
| `<CONTAINER-NAME>` | Compose `container_name`, `.docker/stack.manifest.json` `stackName`, image name, or repo folder name |
| `<USER-PROFILE-NAME>` | `$env:USERNAME` on Windows; `$USER` on Linux/macOS |
| `<RANDOMLY-FROM-SAFE-PORTS-RANGE>` | Random unused port in `30000–32767`; verify with `Get-NetTCPConnection` / `netstat` before writing |

Script conventions (see `create-powershell-script` skill):

- Use `--flag=value` parameters; include `--help`.
- Show help when required args are missing or a flag value is invalid.
- Keep the script simple; progress and colored output are welcome.
- Test with `--help` after create/edit; ask the user before a full deploy run.

**`--help` requirements** — every `run-on-docker.ps1` must implement a `Show-Help` function and print it when the user passes `--help`, `-h`, or `/?`, or when validation fails.

Help output must include, in this order:

1. **Usage** — one-line command syntax with all flags.
2. **Flags** — every flag with default value and a one-line description.
3. **Examples** — at least three copy-paste examples (local, remote, fresh volume).
4. **Notes** — SSH alias rule (`ssh` never inside `--ssh-string`), truthy yes/no values, safe port range.

Template (replace placeholders with project values):

```text
run-on-docker.ps1 — build and deploy <CONTAINER-NAME> in Docker

USAGE:
  .\run-on-docker.ps1 [flags]

FLAGS:
  --ssh-string=<alias>       SSH config alias for remote host (default: localhost)
  --delete-image=<no|yes>    Remove built images during teardown (default: no)
  --delete-volume=<no|yes>    Remove volumes before recreate (default: no)
  --internal-port=<port>     Host port mapped to the container (default: <picked-port>)
  --volume-dir=<path>        Bind-mount data directory (default: /<user>/docker/<CONTAINER-NAME>)
  --volume-name=<name>       Named Docker volume (default: <CONTAINER-NAME>-volume)
  --network-name=<name>      Docker network (default: <CONTAINER-NAME>-net)
  --help                     Show this help

EXAMPLES:
  .\run-on-docker.ps1
  .\run-on-docker.ps1 --delete-volume=yes
  .\run-on-docker.ps1 --ssh-string=myserver --internal-port=30042

NOTES:
  - Use SSH config alias only; do not include "ssh" in --ssh-string.
  - Truthy values for yes/no flags: yes, true, 1, y, on.
  - Default internal port is picked randomly from 30000–32767 if not specified.
```

Implementation sketch:

```powershell
if ($args -match '^(--help|-h|/\?)$') { Show-Help; exit 0 }
```

### Step 2: Clarify with the user (required — do this first)

**Do not build, deploy, delete, or run any script until the user answers.**

Ask in chat. Cover every item below.

| Topic | Ask |
|-------|-----|
| **Connection** | SSH config alias (e.g. `example` for `ssh example`), full SSH string, or local only (`localhost`)? |
| **Container name** | Stack or container name if not obvious from the project |
| **Existing images** | After inspection (Step 3): keep existing images or delete and rebuild? |
| **Existing volumes** | After inspection (Step 3): keep data or delete for a fresh start? |
| **Internal port** | Use random default from `30000–32767` or a fixed port? |
| **Volume location** | Default `/<USER-PROFILE-NAME>/docker/<CONTAINER-NAME>`, existing path, or custom path? |
| **Destructive actions** | Confirm before `--delete-image=yes`, `--delete-volume=yes`, or remote deploy. |

Also ask anything else needed for a safe deploy: Docker context (local vs remote host), network name, compose file location, etc.

### Step 3: Inspect existing Docker state

Before asking about images/volumes, check what already exists:

```powershell
docker images --format "{{.Repository}}:{{.Tag}}" | Select-String -Pattern "<stack-or-container-name>"
docker volume ls
docker ps -a --filter "name=<container-name>"
```

On remote (after user provides SSH alias):

```powershell
ssh <alias> "docker images; docker volume ls; docker ps -a"
```

Present findings to the user, then ask keep vs delete (Step 2 table).

### Step 4: Map answers to script flags

| User choice | Flag |
|-------------|------|
| Local / localhost | `--ssh-string=localhost` (default) |
| SSH alias `example` | `--ssh-string=example` (alias only — never include `ssh`) |
| Delete images | `--delete-image=yes` |
| Keep images | `--delete-image=no` (default) |
| Delete volumes | `--delete-volume=yes` |
| Keep volumes | `--delete-volume=no` (default) |
| Internal port | `--internal-port=<port>` |
| Custom volume dir | `--volume-dir=<path>` |
| Volume name | `--volume-name=<CONTAINER-NAME>-volume` |
| Network name | `--network-name=<CONTAINER-NAME>-net` |

Truthy yes/no values: `yes`, `true`, `1`, `y`, `on`.

### Step 5: Run the script

Run from the directory that contains `run-on-docker.ps1` (usually repo root):

```powershell
.\run-on-docker.ps1 [--flags]
```

**Remote:**

```powershell
.\run-on-docker.ps1 --ssh-string=<alias> [--internal-port=<n>] [--volume-dir=<path>] [--volume-name=<name>] [--network-name=<name>]
```

**Examples after user confirms:**

```powershell
# Local default
.\run-on-docker.ps1

# Fresh local data
.\run-on-docker.ps1 --delete-volume=yes

# Remote deploy
.\run-on-docker.ps1 --ssh-string=example --internal-port=30042
```

When unsure of flags, run help first:

```powershell
.\run-on-docker.ps1 --help
```

### Step 6: Verify and report

- Report the reachable endpoint (host, port, URL) from script output or compose config.
- On failure: read script error output; it prints help on exit.
- Report volume path, image tags, network name, internal port chosen, and any cleanup performed.

## Safety rules

1. **Never** run build, deploy, or delete commands before completing Step 2 and Step 3.
2. **Never** pass `ssh` inside `--ssh-string` — use the config alias only (or `localhost` for local).
3. **Never** use `--delete-image=yes` or `--delete-volume=yes` without explicit user confirmation.
4. **Always** implement `--help` with flags, examples, and notes in every `run-on-docker.ps1`.
5. **Always** create or refresh `run-on-docker.ps1` defaults before first deploy in a new project.
6. **Always** pick a free port inside `30000–32767` for `--internal-port` when not user-specified.
7. **Always** execute the script from the directory that contains it.
8. **Always** show existing images/volumes to the user before asking keep vs delete.

## Key facts & reference

### Prerequisites

- Docker CLI running locally
- `docker-compose.yml` or `Dockerfile` in the project
- Optional: `.docker/stack.manifest.json`
- Remote: SSH config alias in `~/.ssh/config`

### Script parameters

| Flag | Default | Description |
|------|---------|-------------|
| `--ssh-string=<alias>` | `localhost` | SSH config alias for remote deploy; `localhost` for local |
| `--delete-image=<no\|yes>` | `no` | Remove built images during teardown |
| `--delete-volume=<no\|yes>` | `no` | Remove volumes before recreate |
| `--internal-port=<port>` | random `30000–32767` | Container port exposed on the host |
| `--volume-dir=<path>` | `/<USER-PROFILE-NAME>/docker/<CONTAINER-NAME>` | Data bind-mount root |
| `--volume-name=<name>` | `<CONTAINER-NAME>-volume` | Named Docker volume |
| `--network-name=<name>` | `<CONTAINER-NAME>-net` | Docker network |
| `--help` | — | Print flag reference, examples, and notes; exit without deploying |

### `--help` output

| Section | Content |
|---------|---------|
| Usage | `.\run-on-docker.ps1 [flags]` |
| Flags | All seven deploy flags + `--help`, each with default and description |
| Examples | Local default, `--delete-volume=yes`, remote with `--ssh-string` |
| Notes | SSH alias rule, truthy yes/no values, safe port range `30000–32767` |

Triggers: `--help`, `-h`, `/?`, unknown flag, invalid flag value.

### Safe ports range

| Item | Value |
|------|-------|
| Min | `30000` |
| Max | `32767` |
| Selection | Random; confirm port is not in use before writing default |

### Troubleshooting

| Symptom | Check |
|---------|-------|
| Missing compose/Dockerfile | Run from the project directory that contains Docker config |
| `Docker CLI is not available` | Start Docker Desktop / daemon |
| Remote SSH fails | Verify alias in `~/.ssh/config`; value must not include `ssh` |
| Port already in use | Re-pick from `30000–32767` or ask user for a fixed port |
