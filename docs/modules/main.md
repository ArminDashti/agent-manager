# Main process

- `app-paths.ts`: resolves portable root from exe; seeds `caches/`, `mcps/`, `data/hub-cache`, `data/repo-bank`, and `logos/`; `getCachesPath()` for local resource cache
- `settings-store.ts`: read/write `settings.json`; migrates removed platforms and merges defaults for Codex/Grok
- `startup.service.ts`: applies Windows/macOS login-item setting from `settings.startup.runOnLogin`
- `scanner.service.ts`: discovers resources from project platform dot-dirs, platform roots (MCPs/tools), and `caches/` (local source)
- `cache.service.ts`: copies skills/rules/hooks/sub-agents to `caches/` on import; hub install sync; canonical write on create
- `project-bootstrap.service.ts`: creates `.cursor`, `.antigravity`, `.codex`, `.grok`, `.devin`, `.github` scaffold on project import
- `hub.service.ts`: HTTP fetch from GitHub Pages hub; installs to cache then destination
- `repo-bank.service.ts`: git operations for personal backup; `writeResourceFile` for create flow
- `sync.service.ts`: periodic pull-then-push when `sync.enabled` and repo URL set (default 30 min)
- `assignment.service.ts`: copy resources to platform/project targets; assign/unassign per project
- `resource.service.ts`: group summaries (incl. `assignedProjectIds`), project matrix, delete, create via cache+assign, mandatory sync on import
- `watcher.service.ts`: chokidar on project `.cursor` resource dirs + platform MCP/tool paths; debounced `scan:changed`
