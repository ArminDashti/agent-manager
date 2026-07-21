# Renderer

9 pages: Skills, Rules, Hooks, Sub-agents, MCPs, Tools, Hub, Settings, About.

Layout: custom `TitleBar` (frameless window controls), collapsible sidebar (icon-only when collapsed), collapsible nav groups (Resources / Other), resizable 2-panel layouts for edit sub-views.

Resource pages (Skills, Rules, Hooks, Sub-agents, Tools) use a shared table-based UI:
- List roots use `h-full min-h-0`; table scroll containers use `flex-1 min-h-0 overflow-auto` so long grids scroll inside the viewport instead of clipping
- **Skills & Rules list view**: columns for category (inline editable, stored in settings), name, description, project usage, token estimate, last updated, all-projects toggle, install, delete. Row click opens editor. Multi-select category filter and **project filter dropdown** in toolbar. Skills without a stored category get a default from the name prefix before the first hyphen (e.g. `git-local-commit` → `git`).
- **Hooks & Sub-agents list view**: same enhanced grid as skills/rules (description, toggle, row-click edit) with project filter; no category column
- **Tools list view**: name, project usage, tokens, last updated, install, delete, mandatory checkbox
- **Toolbar**: search, optional project/category filters (menus portaled to `document.body` so they paint above the grid), and a **Single / Multiple / Both** Off/On toggle group for project-usage filtering (default: Multiple; persisted in `uiFilters.projectUsageFilter`)
- **Add Skill**: larger modal (720px), select-all projects, navigates directly to editor on create (no success toast)
- **Add Rule/Hook/Sub-agent**: standard modal with success toast
- **Assign/Install view**: project matrix with checkboxes, sortable by name
- **Edit view**: file tree (left) + markdown/JSON editor (right); **Refactor by OpenRouter** button for Skills, Rules, Hooks, Sub-agents
- **List row action**: sparkles icon opens OpenRouter refactor modal (same resource types)

**Markdown editor**: Edit, Preview, and Split modes; live debounced preview; GFM rendering with improved typography.

**Rules naming**: `.cursor` rules use `.mdc`; other platforms use `.md`. The UI groups by base name and displays `Example.md` when both `Example.mdc` and `Example.md` exist.

MCP page: table columns name, status, **tools count**, edit, delete; Add MCP JSON modal. Status probing runs only when opening the MCPs page (`refreshScan({ probeMcps: true })`), not on every global scan. Edit sub-view: JSON editor plus a tools list showing each tool’s **name and description**.

**Settings** (4 tabs):
- **General**: GitHub PAT, Hub URL, Windows startup toggle, sync interval (default 30 min pull+push)
- **Storage**: Git Backup repo, project import (multi-select)
- **Platforms**: single frozen Cursor card (logo, locked badge, read-only root path); no toggle, browse, or other platforms; runtime enables Cursor only
- **OpenRouter**: API token + model id used by Refactor by OpenRouter

**OpenRouter refactor modal**: user enters edit instructions; main process sends resource content + prompt to OpenRouter; preview then Apply writes the file.

**Messages**: global minimal `MessageModal` via `messageStore` (replaces inline status and `confirm()`).

Hub install for skill/rule/hook prompts project picker (installs to project `.cursor`).

Shared components: `ResourcePage`, `ResourceListView`, `HooksListView`, `ResourceAssignView`, `ResourceEditView`, `OpenRouterRefactorModal`, `ResourceTable`, `CategoryFilterDropdown`, `ProjectFilterDropdown`, `AddResourceModal`, `MessageModal`, `Toggle`, `MarkdownEditor`, `JsonEditor`, `FileTree`, `PlatformLogo`, settings tabs under `components/settings/` (incl. `OpenRouterTab`).

State: Zustand `useAppStore` for page navigation, scan results, hub filter. Resource stats and assignment via IPC (`getResourceStats`, `getProjectMatrix`, `applyProjectAssignment`, `setMandatory`, `setResourceCategory`, `deleteResource`, `createResource`, `openRouterRefactor`).

Skills, hooks, rules, and sub-agents load from imported projects only. MCPs and tools still scan platform roots. Skills with the same folder name but different `SKILL.md` content appear as separate rows (`groupKey` = name + hash; short hash shown when names collide). Editing a skill fans out only to same-name peers that still match the pre-edit content hash.
