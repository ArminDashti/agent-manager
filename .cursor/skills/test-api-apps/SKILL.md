---
name: test-api-apps
description: >-
  Tests HTTP/REST API apps by deploying with Docker first, then running health
  checks and API test suites. Use when the user asks to test an API app, smoke-test
  endpoints, verify a deployed API, or run integration tests against a containerized API.
---

# Test API Apps

## Overview

- End-to-end workflow: Docker deploy setup → local deploy → readiness → API tests → report
- **Step 1 is mandatory:** create `.deploy/docker/` from [docker-deploy samples](../docker-deploy/samples/) before any deploy or test
- Exclusions: load/stress testing; production deploy without explicit user request
- Related skills: [docker-deploy](../docker-deploy/SKILL.md), `request-preflight` for risky targets

## Objectives

1. Ensure `.deploy/docker/` exists (from docker-deploy samples) and targets the API app
2. Deploy the API locally and confirm the container is healthy
3. Run project tests and/or smoke requests against live endpoints
4. Report pass/fail with base URL, endpoints exercised, and failure details

## Workflow

Copy this checklist and track progress:

```
Task Progress:
- [ ] 1. Create .deploy/docker/ from docker-deploy samples
- [ ] 2. Verify Dockerfile + docker-compose.yml
- [ ] 3. Configure local YAML for API port
- [ ] 4. Deploy locally
- [ ] 5. Wait for readiness
- [ ] 6. Run API tests
- [ ] 7. Report results
```

### Step 1: Create Docker deploy (mandatory first)

Follow [docker-deploy](../docker-deploy/SKILL.md). Copy all four files from `.cursor/skills/docker-deploy/samples/` into `.deploy/docker/`:

| Target | Source sample |
|--------|---------------|
| `.deploy/docker/run-on-docker-local.ps1` | `samples/run-on-docker-local.ps1` |
| `.deploy/docker/run-on-docker-local.yaml` | `samples/run-on-docker-local.yaml` |
| `.deploy/docker/run-on-docker-server.ps1` | `samples/run-on-docker-server.ps1` |
| `.deploy/docker/run-on-docker-server.yaml` | `samples/run-on-docker-server.yaml` |

Adapt `stack_name`, `image_tag`, `compose_file`, `dockerfile`, `docker_network`, and ports for the API app. Do not skip this step even if deploy files already exist — verify they match the current sample contract.

### Step 2: Verify Dockerfile and docker-compose.yml

| Check | Action if missing |
|-------|-------------------|
| `dockerfile` or `Dockerfile` at path in YAML | Create minimal multi-stage or single-stage build that exposes the API port |
| `docker-compose.yml` at path in YAML | Create service using `${IMAGE_TAG}`, `${DOCKER_NETWORK}`, `${INTERNAL_PORT}`; map host port for local tests (e.g. `"${PUBLISH_PORT:-8080}:${INTERNAL_PORT:-8080}"`) |
| Health route | Note `/health`, `/healthz`, or OpenAPI `/docs` from app code or README |

Compose should reference the pre-built image tag from YAML — deploy scripts run `docker build` before `compose up`.

### Step 3: Configure local YAML for testing

Edit `.deploy/docker/run-on-docker-local.yaml`:

| Key | Testing value |
|-----|---------------|
| `internal_port` | API listen port inside the container |
| `delete_volume` | `no` for faster re-runs; `yes` only when a clean DB/state is required |
| `delete_image` | `no` unless rebuilding from scratch |

Ensure `docker-compose.yml` publishes a host port. Record the base URL (e.g. `http://localhost:8080`).

### Step 4: Deploy locally

From repo root:

```powershell
.\.deploy\docker\run-on-docker-local.ps1
```

Fix build or compose errors before continuing. Do not test against a failed deploy.

### Step 5: Wait for readiness

1. Confirm container is running: `docker compose -p <stack_name> ps`
2. Poll health endpoint until 2xx or timeout (~60s, 2s interval)
3. Default probes (try in order): `/health`, `/healthz`, `/api/health`, `/` (expect non-5xx for root)

Use [samples/smoke-api.ps1](samples/smoke-api.ps1) when no project test runner exists.

### Step 6: Run API tests

Prefer the project's existing test command when present:

| Signal in repo | Command |
|----------------|---------|
| `package.json` scripts (`test`, `test:integration`, `test:e2e`) | `npm run <script>` against deployed base URL |
| `pytest` + integration markers | `pytest` with base URL env var from app docs |
| `*.http` / REST Client files | Execute key requests via curl or IDE |
| OpenAPI / Swagger spec | Hit documented paths; validate status codes |

Set env vars the app expects (e.g. `API_BASE_URL`, `BASE_URL`) from the host port in compose.

Minimum smoke (when no suite exists):

```powershell
.\.cursor\skills\test-api-apps\samples\smoke-api.ps1 -BaseUrl http://localhost:8080 -HealthPath /health
```

Copy the script into `.deploy/docker/` or invoke from the skill path for one-off checks.

### Step 7: Report results

Include in the response:

| Field | Content |
|-------|---------|
| Base URL | Host + port used |
| Deploy | Stack name, image tag, pass/fail |
| Readiness | Health endpoint and latency to ready |
| Tests | Command(s) run, pass/fail counts |
| Failures | Status code, body snippet, suggested fix |

Teardown only when the user asks — leave the stack up for manual inspection by default.

## Safety rules

1. **Always** complete Step 1 (docker deploy from samples) before deploy or test
2. **Never** hit production URLs unless the user explicitly requests it
3. **Never** invent SSH credentials for server deploy during local API testing
4. **Never** store or log secrets from API responses or `.env` files
5. **Always** use the local deploy script — do not run sample scripts directly from the skill folder

## Key facts & reference

| Item | Value |
|------|-------|
| Skill path | `.cursor/skills/test-api-apps/SKILL.md` |
| Deploy samples | `.cursor/skills/docker-deploy/samples/` |
| Deploy output | `.deploy/docker/` (four files) |
| Local deploy | `.\.deploy\docker\run-on-docker-local.ps1` |
| Smoke script | [samples/smoke-api.ps1](samples/smoke-api.ps1) |
| Default health paths | `/health`, `/healthz`, `/api/health` |
| Compose env vars | `IMAGE_TAG`, `DOCKER_NETWORK`, `INTERNAL_PORT`, `PUBLISH_PORT` |

### Common blockers

| Blocker | Fix |
|---------|-----|
| No Dockerfile | Add build that copies app and exposes API port |
| Port not published | Add host mapping in `docker-compose.yml` |
| Health never 2xx | Check logs: `docker compose -p <stack> logs` |
| Tests hit wrong host | Set `BASE_URL` / `API_BASE_URL` to localhost publish port |
