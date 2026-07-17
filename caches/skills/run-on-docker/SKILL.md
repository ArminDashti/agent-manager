---
name: run-on-docker
description: >-
  Builds and deploys the exar Docker stack (API + web UI) locally or over SSH
  using run-on-docker.ps1. Covers local compose runs, remote image transfer,
  volume/image teardown, sslh domain mapping, and legacy api/webui scripts.
  Use when the user asks to run, build, or deploy exar in Docker, start the
  compose stack, deploy over SSH, map a domain, or mentions run-on-docker.ps1.
---

# exar run-on-docker

Run the existing PowerShell deploy scripts — do not reimplement Docker steps manually.

## Which script

| Path | Use when |
|------|----------|
| `run-on-docker.ps1` (repo root) | **Default** — full API + web stack |
| `api/run-on-docker.ps1` | Legacy API-only stack |
| `webui/run-on-docker.ps1` | Legacy web-only stack (builds Vite assets first) |

Prefer the repo-root script unless the user explicitly targets `api/` or `webui/`.

## Prerequisites

- Docker CLI running locally
- Repo root files: `docker-compose.yml`, `Dockerfile`, `nginx.conf.template`
- Optional: `.docker/stack.manifest.json` (image tags, ports, container names)
- Remote deploy: SSH config alias (e.g. `example` in `~/.ssh/config`); script prepends `ssh` — never pass `ssh` in the value

## Root script parameters

| Flag | Default | Description |
|------|---------|-------------|
| `--ssh-string=<alias>` | local | SSH config alias for remote deploy |
| `--delete-image=<no\|yes>` | `no` | Remove built images during teardown |
| `--delete-volume=<no\|yes>` | `no` | Remove volumes before recreate |
| `--reverse-proxy=<sslh\|none>` | `sslh` | Remote: `sslh` = no host ports; `none` = publish 8080/8082 |
| `--domain=<hostname>` | — | Map hostname to web container (requires `--ssh-string`) |
| `--internal-port=<port>` | `80` | Web container port for domain routing |
| `--public-port=<port>` | `443` | Public HTTPS port for sslh/nginx |
| `--volume-dir=<path>` | `/<USERNAME>/docker/<CONTAINER-NAME>` | API data bind-mount |
| `--help` | — | Show usage |

Truthy values for yes/no flags: `yes`, `true`, `1`, `y`, `on`.

## Workflows

### Local (default)

```powershell
.\run-on-docker.ps1
```

1. Validates Docker files
2. `docker compose build` (API + web images)
3. Ensures data dir and `exar-net` network
4. `docker compose up -d`

**Endpoints:** Web UI `http://localhost:8082` · API `http://localhost:8080`

### Fresh local data

```powershell
.\run-on-docker.ps1 --delete-volume=yes
```

### Remote deploy

```powershell
.\run-on-docker.ps1 --ssh-string=example
```

1. Builds images locally
2. Syncs compose files to remote work dir (`/<username>/docker/exar` by default)
3. `docker save` → scp → `docker load` on remote
4. Starts compose without remote build

### Remote with domain (sslh)

```powershell
.\run-on-docker.ps1 --ssh-string=example --domain=exar.example.com --internal-port=80
```

Requires a running `sslh` container on the remote host. Script patches sslh SNI config and starts an `exar-web-tls` terminator.

### Publish host ports on remote

```powershell
.\run-on-docker.ps1 --ssh-string=example --reverse-proxy=none
```

## Legacy scripts

**`api/run-on-docker.ps1`**

```powershell
cd api
.\run-on-docker.ps1 [--ssh-string=<alias>] [--delete-volume=<no|yes>]
```

**`webui/run-on-docker.ps1`**

```powershell
cd webui
.\run-on-docker.ps1 [--ssh-string=<alias>] [--delete-volume=<no|yes>] [--network=exar-net] [--api-host=exar] [--api-port=8080]
```

Runs `npm install` / `npm run build` before the Docker image build.

## Agent rules

1. **Execute the script** from the correct directory; pass flags with `--name=value`.
2. **Ask before destructive runs** (`--delete-volume=yes`, `--delete-image=yes`, remote deploy).
3. **Show help first** when unsure: `.\run-on-docker.ps1 --help`
4. **Do not edit** `run-on-docker.ps1` unless the user asks — fix deploy issues by adjusting flags or prerequisites.
5. On failure, read the script's error output; it prints help on exit.

## Manifest defaults

From `.docker/stack.manifest.json`:

| Key | Default |
|-----|---------|
| `stackName` | `exar` |
| `containerName` / API host | `exar` |
| `internalPort` / API port | `8080` |
| `apiImageTag` | `exar-api:latest` |
| `webImageTag` | `exar-web:latest` |
| Docker network | `exar-net` |

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Missing compose/Dockerfile | Run from repo root (or `api/` / `webui/` for legacy) |
| `--domain requires --ssh-string` | Domain mapping is remote-only |
| `sslh container not found` | Start sslh on remote before domain deploy |
| `Docker CLI is not available` | Start Docker Desktop / daemon |
| Remote SSH fails | Verify alias in `~/.ssh/config`; value must not include `ssh` |

## Related docs

- [docs/modules/docker.md](../../docs/modules/docker.md) — stack architecture and file reference
