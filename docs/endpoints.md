# Endpoints

## CLI scripts

| Command | Description |
|---------|-------------|
| `.\install.ps1` | Run `npm install`, build portable app to `release/`, deploy layout to project root |
| `.\install.ps1 -Dir C:\Janus` | Build and deploy to a custom install directory |
| `.\install.ps1 --ShowHelp` | Show usage for install script |

## IPC

All channels exposed via `window.agentManager` (preload `contextBridge`).

| Channel | Direction | Description |
|---------|-----------|-------------|
| `app:getRoot` | invoke | Portable app root directory |
| `settings:get` | invoke | Load `settings.json` |
| `settings:save` | invoke | Save settings; when platforms change, syncs enabled platform folders + project resources |
| `settings:reset` | invoke | Reset to defaults |
| `pat:get` / `pat:set` | invoke | GitHub PAT via keytar |
| `github:validatePat` | invoke | Validate GitHub PAT |
| `openRouter:refactor` | invoke | Refactor skill/rule/hook/subAgent content via OpenRouter chat completions |
| `scan:all` | invoke | Full resource scan. Optional `{ probeMcps?: boolean }` — MCP process probing is off by default (expensive); enable on MCPs page |
| `scan:projects` | invoke | Discover `.git` projects under path |
| `file:read` / `file:write` | invoke | Local file I/O |
| `file:listDir` | invoke | Recursive file list (scanner use only) |
| `file:listEntries` | invoke | Shallow directory listing (files + folders) |
| `dialog:openDirectory` | invoke | Native folder picker |
| `dialog:openDirectories` | invoke | Multi-select folder picker |
| `assign:targets` | invoke | Assign targets for resource type |
| `resource:stats` | invoke | Grouped resource summaries (tokens, project usage, `groupKey`; skills group by `name::contentHash`) |
| `assign:getProjectMatrix` | invoke | Project assignment matrix for a resource (`resourceName` is `groupKey` for skills) |
| `assign:apply` | invoke | Apply project assignment checkboxes |
| `assign:setMandatory` | invoke | Toggle mandatory-for-all-projects; auto-assigns when enabled |
| `resource:setCategory` | invoke | Set skill/rule category in settings |
| `resource:delete` | invoke | Delete resource from disk |
| `resource:create` | invoke | Create skill/rule/hook/subAgent in project `.cursor` + repo bank |
| `resource:getCanonical` | invoke | Get canonical instance for edit view (skills: pass `groupKey`) |
| `mcp:add` | invoke | Add MCP server entry to platform mcp.json |
| `mcp:delete` | invoke | Remove MCP server from mcp.json |
| `platform:add` | invoke | Add/update platform path |
| `projectRoot:add` | invoke | Add project scan root |
| `projects:import` | invoke | Import multiple git repos or scan folders |
| `projects:remove` | invoke | Remove a configured project by id |
| `hub:fetchCatalog` | invoke | GET hub manifest |
| `hub:list` | invoke | List hub catalog items |
| `hub:fetchResource` | invoke | Download resource to `data/hub-cache/` |
| `hub:install` | invoke | Copy cached hub resource to target |
| `repoBank:fetch` | invoke | Git pull repo bank |
| `repoBank:commitPush` | invoke | Git commit & push repo bank |
| `logos:getPath` | invoke | Platform logo file path |
| `window:minimize` | invoke | Minimize focused window |
| `window:maximize` | invoke | Toggle maximize on focused window |
| `window:close` | invoke | Close window (persists maximized state) |
| `window:isMaximized` | invoke | Whether focused window is maximized |
| `scan:changed` | event (main→renderer) | File watcher refresh trigger |
