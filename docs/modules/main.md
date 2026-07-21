# Main process

- `app-paths.ts`: resolves portable root from exe; creates `imported-projects.json`, `categories.json`, `.trash/`; runtime data in Electron userData
- `ipc/index.ts`: includes temporary `debug:log` IPC for session debug NDJSON (remove after investigation)
- `settings-store.ts`: read/write `settings.json`; migrates removed platforms, merges defaults, and forces only Cursor `enabled: true` (other platforms kept but disabled) on load and save
- `scanner.service.ts`: discovers resources from project platform dot-dirs and platform roots (MCPs/tools only at platform level). `scanAll(settings, { probeMcps })` — MCP stdio probing is opt-in; concurrent callers share one in-flight scan; skills get `contentHash` (sha256 of `SKILL.md`) and seed the skill-sync hash cache
- `project-bootstrap.service.ts`: scaffolds `skills`/`rules`/`tools` (plus Cursor `hooks`/`agents`) for given or enabled platforms on import and sync
- `platform-sync.service.ts`: on app start and when platforms change — ensures enabled platform folders in all projects, then re-copies project-assigned skills/rules/hooks/agents/tools into every enabled platform (effectively Cursor-only while other platforms stay disabled)
- `hub.service.ts`: HTTP fetch from GitHub Pages hub; downloads to `data/hub-cache` then copies to chosen destination
- `openrouter.service.ts`: OpenRouter chat completions for refactoring skill/rule/hook/subAgent content using settings token + model
- `repo-bank.service.ts`: git operations for personal backup; `writeResourceFile` for create flow
- `sync.service.ts`: periodic pull-then-push when `sync.enabled` and repo URL set (default 30 min)
- `assignment.service.ts`: copy resources to platform/project targets; assign/unassign per project; refuses skill assign when target same-name folder has a different `SKILL.md` hash
- `resource.service.ts`: group summaries (incl. `assignedProjectIds`, `groupKey`); skills group by `name::contentHash` so same folder name with different `SKILL.md` are unique; project matrix/delete/assign/mandatory/category keyed by `groupKey` for skills; create by seeding projects + repo-bank; mandatory sync on import; auto-assigns skill categories from name prefix when unset; descriptions from YAML frontmatter (incl. block scalars)
- `skill-sync.service.ts`: on skill folder disk changes, fan-out only to same-name peers whose `SKILL.md` still matches the pre-edit content hash (skips divergent unique skills); reentrancy-guarded; first sighting records hash without fan-out
- `watcher.service.ts`: chokidar on project resource dirs (all platforms’ skills dirs) + platform MCP/tool paths; schedules skill fan-out then debounced `scan:changed`
