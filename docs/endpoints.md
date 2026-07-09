# IPC Endpoints

All channels exposed via `window.agentManager` (preload `contextBridge`).

| Channel | Direction | Description |
|---------|-----------|-------------|
| `app:getRoot` | invoke | Portable app root directory |
| `settings:get` | invoke | Load `settings.json` |
| `settings:save` | invoke | Save settings |
| `settings:reset` | invoke | Reset to defaults |
| `pat:get` / `pat:set` | invoke | GitHub PAT via keytar |
| `scan:all` | invoke | Full resource scan |
| `scan:projects` | invoke | Discover `.git` projects under path |
| `file:read` / `file:write` | invoke | Local file I/O |
| `file:listDir` | invoke | Recursive file list |
| `dialog:openDirectory` | invoke | Native folder picker |
| `assign:targets` | invoke | Assign targets for resource type |
| `platform:add` | invoke | Add/update platform path |
| `projectRoot:add` | invoke | Add project scan root |
| `hub:fetchCatalog` | invoke | GET hub manifest |
| `hub:list` | invoke | List hub catalog items |
| `hub:fetchResource` | invoke | Download resource to `data/hub-cache/` |
| `hub:install` | invoke | Copy cached hub resource to target |
| `repoBank:fetch` | invoke | Git pull repo bank |
| `repoBank:commitPush` | invoke | Git commit & push repo bank |
| `logos:getPath` | invoke | Platform logo file path |
| `scan:changed` | event (main→renderer) | File watcher refresh trigger |
