# Directory tree

```
agent-manager/
├── install.ps1              # npm install, clean release/, rebuild portable exe
├── docs/                    # Project documentation
├── resources/
│   ├── logos/               # Bundled platform SVG logos
│   └── settings.template.json
├── src/
│   ├── main/                # Electron main process
│   │   ├── index.ts         # App entry, frameless window, no app menu
│   │   ├── app-paths.ts     # Portable path resolution
│   │   ├── ipc/index.ts     # IPC handlers
│   │   ├── platforms/       # Platform adapters (6 platforms)
│   │   └── services/        # Scanner, file, hub, repo bank, resource, assignment, watcher
│   ├── preload/index.ts     # contextBridge API
│   ├── renderer/            # React UI (9 pages)
│   │   ├── components/layout/     # TitleBar, Sidebar, resizable panel layouts
│   │   ├── components/resources/  # Resource table, list, assign, edit views
│   │   ├── components/            # McpFieldPicker, McpFieldEditor, editors
│   │   ├── lib/mcpParams.ts       # MCP param path utilities
│   │   └── pages/                 # Skills, Rules, Hooks, Sub-agents, MCPs, Tools, Hub, Settings, About
│   └── shared/              # Types, defaults, utils
├── out/                     # Build output
├── release/                 # electron-builder output
├── data/                    # Created at runtime (dev)
├── logos/                   # Created at runtime from resources
└── settings.json            # Created at runtime (platforms, projectRoots, assignments)
```
