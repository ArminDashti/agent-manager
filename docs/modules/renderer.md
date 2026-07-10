# Renderer

9 pages: Skills, Rules, Hooks, Sub-agents, MCPs, Tools, Hub, Settings, About.

Layout: custom `TitleBar` (frameless window controls), collapsible sidebar (icon-only when collapsed), collapsible nav groups (Resources / Other), resizable 2-panel layouts for edit sub-views.

Resource pages (Skills, Rules, Hooks, Sub-agents, Tools) use a shared table-based UI:
- **Skills & Rules list view**: columns for category (inline editable, stored in settings), name, description (truncated with hover tooltip), project usage, token estimate, last updated, all-projects toggle, install, delete. Row click opens editor. Category filter in toolbar.
- **Hooks, Sub-agents, Tools list view**: name, project usage, tokens, last updated, install, edit, delete, mandatory checkbox
- **Add Skill**: larger modal (720px), select-all projects, navigates directly to editor on create (no success toast)
- **Add Rule/Hook/Sub-agent**: standard modal with success toast
- **Assign/Install view**: project matrix with checkboxes, sortable by name
- **Edit view**: file tree (left) + markdown/JSON editor (right)

**Rules naming**: `.cursor` rules use `.mdc`; other platforms use `.md`. The UI groups by base name and displays `Example.md` when both `Example.mdc` and `Example.md` exist.

MCP page: single table (name, status, edit, delete) with Add MCP JSON modal and edit sub-view.

**Settings** (3 tabs):
- **General**: GitHub PAT, Hub URL, sync interval (default 30 min pull+push)
- **Storage**: Git Backup repo, project import (multi-select)
- **Platforms**: all 8 platforms alphabetically with logo, path, enabled toggle

**Messages**: global minimal `MessageModal` via `messageStore` (replaces inline status and `confirm()`).

Hub install for skill/rule/hook prompts project picker (installs to project `.cursor`).

Shared components: `ResourcePage`, `ResourceListView`, `ResourceAssignView`, `ResourceEditView`, `ResourceTable`, `AddResourceModal`, `MessageModal`, `Toggle`, `MarkdownEditor`, `JsonEditor`, `FileTree`, `PlatformLogo`, `McpFieldPicker`, `McpFieldEditor`, settings tabs under `components/settings/`.

State: Zustand `useAppStore` for page navigation, scan results, hub filter. Resource stats and assignment via IPC (`getResourceStats`, `getProjectMatrix`, `applyProjectAssignment`, `setMandatory`, `setResourceCategory`, `deleteResource`, `createResource`).

Skills, hooks, rules, and sub-agents load from imported projects only. MCPs and tools still scan platform roots.
