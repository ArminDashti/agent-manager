---
name: docker-deploy
description: >-
  Create Docker deploy files under .deploy/docker from skill samples
  (run-on-docker-local/server .ps1 + .yaml). Use when adding or editing
  local/server Docker deploy scripts or YAML under .deploy/docker.
---

# Docker Deploy

## Overview

- Owns create / edit of Docker deploy assets under `.deploy/docker/`
- Copy and adapt the four files from `samples/` — do not invent a different contract
- Exclusions: app business logic; inventing real SSH credentials

## Objectives

1. Create the full `.deploy/docker/` set when missing, or edit the existing set.
2. Base each of the four files on the matching sample.
3. Leave `ssh` / `ssh_key` as placeholders unless the user provided values.

## Workflow

### Step 1: Create these files under `.deploy/docker/`

Copy from this skill’s `samples/`, then adapt names/ports/paths for the project:

| Path | Role | Sample |
|------|------|--------|
| `run-on-docker-local.ps1` | Local Docker daemon deploy | [samples/run-on-docker-local.ps1](samples/run-on-docker-local.ps1) |
| `run-on-docker-local.yaml` | Local settings | [samples/run-on-docker-local.yaml](samples/run-on-docker-local.yaml) |
| `run-on-docker-server.ps1` | Remote SSH deploy | [samples/run-on-docker-server.ps1](samples/run-on-docker-server.ps1) |
| `run-on-docker-server.yaml` | Remote settings (`ssh`, `ssh_key`) | [samples/run-on-docker-server.yaml](samples/run-on-docker-server.yaml) |

**Read samples as templates** (adapt and write into the target repo). Do not execute the sample scripts from the skill folder.

## Safety rules

1. **Never** invent hosts, aliases, passwords, or key paths.
2. **Never** print the password segment of `host@user@password` — log `user@host` or `ssh <alias>` only.
3. **Never** add CLI `--` flags; change behavior only via YAML.

## Key facts & reference

| Item | Value |
|------|-------|
| Deploy root | `.deploy/docker/` |
| Samples dir | `.cursor/skills/docker-deploy/samples/` |
| Local pair | [run-on-docker-local.ps1](samples/run-on-docker-local.ps1) + [run-on-docker-local.yaml](samples/run-on-docker-local.yaml) |
| Server pair | [run-on-docker-server.ps1](samples/run-on-docker-server.ps1) + [run-on-docker-server.yaml](samples/run-on-docker-server.yaml) |
| SSH placeholder | `ssh: "ssh <alias>"` / `ssh_key: "<path-to-private-key>"` |
| Build context | Repo root; Dockerfile at `.deploy/docker/Dockerfile` |
| Server flow | Build locally → `docker save` → SCP → remote `docker load` → sync `sync_items` → remote compose `up -d` (no remote build) |
