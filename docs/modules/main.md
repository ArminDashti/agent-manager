# Main process

- `app-paths.ts`: resolves portable root from exe; seeds `data/` and `logos/`
- `settings-store.ts`: read/write `settings.json`
- `scanner.service.ts`: discovers resources — skills/hooks/rules/sub-agents from project `.cursor` dirs only; MCPs/tools from platform roots
- `hub.service.ts`: HTTP fetch from GitHub Pages hub
- `repo-bank.service.ts`: git operations for personal backup; `writeResourceFile` for create flow
- `sync.service.ts`: periodic pull-then-push when `sync.enabled` and repo URL set (default 30 min)
- `assignment.service.ts`: copy resources to platform/project targets; assign/unassign per project
- `resource.service.ts`: group summaries, project matrix, delete, create, mandatory-for-all-projects sync
- `watcher.service.ts`: chokidar on project `.cursor` resource dirs + platform MCP/tool paths; debounced `scan:changed`
