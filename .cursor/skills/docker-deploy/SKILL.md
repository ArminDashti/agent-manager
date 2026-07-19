---
name: docker-deploy
description: >
  Create, edit, audit, and run Docker deploy files under .deploy/docker (Dockerfile,
  docker-compose.yml, run-on-docker-*.ps1/yaml, common.ps1). Use when the user asks
  to add or change Docker/deploy scripts, Dockerfile, compose, local/server Docker
  run, SSH deploy, or when .deploy/docker (or legacy deploy/docker) already exists
  and must follow this convention.
---

# Docker Deploy (universal)

This skill is for **creating and editing** Docker-related deploy files, then
keeping them compliant and runnable. Scope is the `.deploy/docker/` convention
in any repo — not app business logic.

**In scope (create / edit / move / fix):**

- `Dockerfile`
- `docker-compose.yml`
- `run-on-docker-local.ps1` / `run-on-docker-local.yaml`
- `run-on-docker-server.ps1` / `run-on-docker-server.yaml`
- `common.ps1` (shared helpers)
- Root stubs that only redirect to `.deploy/docker/`
- Migrating legacy root/`deploy/docker` Docker files into `.deploy/docker/`

**Out of scope:** application feature code unrelated to packaging/deploy.

**Never invent real SSH credentials** — leave `ssh` / `ssh_key` placeholders
unless the user explicitly provided values.

## First action (required)

Before creating, editing, or running any of the files above:

1. Check whether `.deploy/docker/` (or legacy `deploy/docker/`) already exists.
2. If it **exists** → follow **Existing setup audit** and fix drift so every
   related file follows this skill, then apply the requested create/edit.
3. If it **does not exist** → follow **Creating / editing Docker files**.

Do not skip the audit when Docker deploy files are already on disk.

## Existing setup audit

When any Docker deploy assets already exist, copy this checklist and complete it
**before** further creates/edits:

```
Audit Progress:
- [ ] 1. Inventory Docker-related paths on disk
- [ ] 2. Align layout to .deploy/docker/
- [ ] 3. Verify scripts match procedure
- [ ] 4. Verify YAML contract
- [ ] 5. Verify SSH placeholders / user values
- [ ] 6. Verify Dockerfile + compose behavior
- [ ] 7. Report remaining gaps to the user
```

### 1. Inventory Docker-related paths on disk

Search for and read:

- `.deploy/docker/**`
- legacy `deploy/docker/**` (migrate into `.deploy/docker/` if found)
- repo-root `Dockerfile`, `docker-compose.yml`, `docker-compose.*.yml`, `.dockerignore`
- repo-root `run-on-docker*.ps1` (stubs only, or move under `.deploy/docker/`)

### 2. Align layout

Required under `.deploy/docker/`:

| Path | Role |
| ---- | ---- |
| `run-on-docker-local.ps1` | Local Docker daemon deploy |
| `run-on-docker-local.yaml` | Local settings |
| `run-on-docker-server.ps1` | Remote SSH deploy |
| `run-on-docker-server.yaml` | Remote settings (`ssh`, `ssh_key`) |
| `Dockerfile` | App image definition |
| `docker-compose.yml` | Stack services |
| `common.ps1` | Shared helpers (preferred) |

If something is missing, **create** it. If something is in the wrong place,
**move/edit** it and update references. Root-level deploy scripts may only
stub/redirect to `.deploy/docker/`.

### 3. Verify scripts match procedure

**Edit** scripts when any of these fail:

| Check | Required behavior |
| ----- | ----------------- |
| CLI | No `--` flags (local and server) |
| Config source | Settings come only from sibling YAML |
| Local build | `docker build -f .deploy/docker/Dockerfile <repo-root>` then compose `up -d` |
| Server deploy | Build locally → `docker save` → SCP → remote `docker load` → sync `sync_items` → remote compose `up -d` (no remote build) |
| Network | Ensure external `docker_network` exists before `up` |
| SSH parse | `ssh` supports `ssh <alias>` and `host@user@password` |
| SSH key | Alias mode requires `ssh_key` file and uses `ssh -i` |
| Placeholders | Reject `<...>` / empty placeholder SSH values at runtime |
| Secrets in logs | Never print password segment of `host@user@password` |

### 4. Verify YAML contract

Both YAMLs should define (as applicable):

| Key | Meaning |
| --- | ------- |
| `stack_name` | Compose project name (`-p`) |
| `image_tag` | Image built and run |
| `compose_file` | Compose filename under `.deploy/docker` |
| `docker_network` | External Docker network name |
| `api_publish_port` | Host publish port; `""` behind reverse proxy |
| `delete_volume` / `delete_image` | Truthy: `yes` / `true` / `1` / `y` / `on` |

Server-only:

| Key | Meaning |
| --- | ------- |
| `ssh` | User-defined: `ssh <alias>` or `host@user@password` |
| `ssh_key` | User-defined private key path (required for alias mode) |
| `remote_work_dir` | Absolute remote directory for compose files |
| `sync_items` | Filenames under `.deploy/docker` to SCP |

Compose services must use pre-built `image:` (scripts own the build), not
`build:` as the primary path.

### 5. Verify SSH placeholders / user values

- If `ssh` / `ssh_key` are missing → **create** placeholders only.
- If they already contain **user-provided real values** → keep them; do not
  overwrite with placeholders.
- If they contain invented/example credentials → **edit** back to placeholders
  and tell the user to fill them.

```yaml
ssh: "ssh <alias>"
ssh_key: "<path-to-private-key>"
```

### 6. Verify Dockerfile + compose behavior

Confirm / **edit** so that:

1. Build context = repo root; Dockerfile path = `.deploy/docker/Dockerfile`.
2. Scripts build/tag the image; compose does not build.
3. Server never builds on the remote host.
4. `.dockerignore` (if present) still allows a correct repo-root build context.

### 7. Report gaps

Tell the user what was already compliant, what you created/edited, and what
they still must fill (especially `ssh` / `ssh_key`).

## Creating / editing Docker files

Use this when adding the pattern or changing Docker-related files.

### Create (new repo / missing files)

1. Create `.deploy/docker/` with Dockerfile, compose, local/server scripts + YAML, helpers.
2. Point compose at pre-built `image:` (scripts own the build).
3. Set stack keys from the project; leave `ssh` / `ssh_key` as placeholders.
4. Ask the user to fill SSH values before running server deploy.

### Edit (existing files)

1. Run **Existing setup audit** first.
2. Apply the user’s requested Docker/deploy change under `.deploy/docker/`.
3. Re-check the procedure table (CLI, YAML-only config, build/transfer flow, SSH).
4. Do not reintroduce root-level real Dockerfiles/compose if the convention is
   `.deploy/docker/` — update stubs instead.

## Rules

1. **This skill owns Docker deploy file create/edit** under `.deploy/docker/`.
2. **No CLI params** — change behavior only via the YAML files.
3. **User defines SSH** — placeholders unless the user explicitly provided values.
4. **Do not invent** hosts, aliases, passwords, or key paths.
5. **Alias mode requires `ssh_key`** — used as `ssh -i`.
6. **Never print passwords** — log `user@host` or `ssh <alias>` only.
7. **Build context = repo root**.
8. **Scripts build; compose does not** — no remote build on server.
9. **External network** — create/use `docker_network` from YAML before `up`.
10. **Existing Docker files must follow this skill** — audit and fix drift first.

## Which script

| Goal | Script | Config |
| ---- | ------ | ------ |
| This machine | `run-on-docker-local.ps1` | `run-on-docker-local.yaml` |
| Remote host | `run-on-docker-server.ps1` | `run-on-docker-server.yaml` |

## Local flow

```
Task Progress:
- [ ] 0. Existing setup audit / create-or-edit Docker files as needed
- [ ] 1. Edit run-on-docker-local.yaml for this project
- [ ] 2. Run .\.deploy\docker\run-on-docker-local.ps1
- [ ] 3. Verify the published local URL/port from YAML
```

## Server flow

```
Task Progress:
- [ ] 0. Existing setup audit / create-or-edit Docker files as needed
- [ ] 1. User fills ssh + ssh_key in run-on-docker-server.yaml
- [ ] 2. Run .\.deploy\docker\run-on-docker-server.ps1
- [ ] 3. Verify stack at remote_work_dir
```

## Agent checklist

1. Treat requests about Dockerfile, compose, or run-on-docker as **create/edit**
   work under this skill.
2. If Docker deploy files exist on disk → audit and fix drift, then edit.
3. If they do not exist → create the full `.deploy/docker/` set.
4. Do not add CLI flags; do not invent SSH credentials.
5. If server deploy is requested and `ssh`/`ssh_key` are still placeholders, stop and ask the user to fill them.
