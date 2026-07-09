# Main process

- `app-paths.ts`: resolves portable root from exe; seeds `data/` and `logos/`
- `settings-store.ts`: read/write `settings.json`
- `scanner.service.ts`: discovers skills, rules, MCPs, hooks, sub-agents, tools
- `hub.service.ts`: HTTP fetch from GitHub Pages hub
- `repo-bank.service.ts`: git operations for personal backup
- `assignment.service.ts`: assign targets (Cursor-only for hooks/sub-agents)
- `watcher.service.ts`: chokidar file watcher → `scan:changed` event
