# Main process

- `app-paths.ts`: resolves portable root from exe; seeds `mcps/`, `data/hub-cache`, `data/repo-bank`, and `logos/`
- `ipc/index.ts`: includes temporary `debug:log` IPC for session debug NDJSON (remove after investigation)
- `settings-store.ts`: read/write `settings.json`; migrates removed platforms and merges defaults for Codex/Grok/OpenRouter
- `startup.service.ts`: applies Windows/macOS login-item setting from `settings.startup.runOnLogin`
- `scanner.service.ts`: discovers resources from project platform dot-dirs and platform roots (MCPs/tools only at platform level). `scanAll(settings, { probeMcps })` — MCP stdio probing is opt-in; concurrent callers share one in-flight scan
- `project-bootstrap.service.ts`: creates `.cursor`, `.antigravity`, `.codex`, `.grok`, `.devin`, `.github` scaffold on project import
- `hub.service.ts`: HTTP fetch from GitHub Pages hub; downloads to `data/hub-cache` then copies to chosen destination
- `openrouter.service.ts`: OpenRouter chat completions for refactoring skill/rule/hook/subAgent content using settings token + model
- `repo-bank.service.ts`: git operations for personal backup; `writeResourceFile` for create flow
- `sync.service.ts`: periodic pull-then-push when `sync.enabled` and repo URL set (default 30 min)
- `assignment.service.ts`: copy resources to platform/project targets; assign/unassign per project
- `resource.service.ts`: group summaries (incl. `assignedProjectIds`), project matrix, delete, create by seeding projects + repo-bank, mandatory sync on import; auto-assigns skill categories from name prefix when unset; descriptions from YAML frontmatter (incl. block scalars)
- `skill-sync.service.ts`: on skill folder disk changes, copy the changed skill to every other project that already has that skill (reentrancy-guarded)
- `watcher.service.ts`: chokidar on project resource dirs (all platforms’ skills dirs) + platform MCP/tool paths; schedules skill fan-out then debounced `scan:changed`
