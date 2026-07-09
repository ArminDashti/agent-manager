# Directory tree

```
agent-manager/
├── docs/                    # Project documentation
├── resources/
│   ├── logos/               # Bundled platform SVG logos
│   └── settings.template.json
├── src/
│   ├── main/                # Electron main process
│   │   ├── index.ts         # App entry, maximize window
│   │   ├── app-paths.ts     # Portable path resolution
│   │   ├── ipc/index.ts     # IPC handlers
│   │   ├── platforms/       # Platform adapters (6 platforms)
│   │   └── services/        # Scanner, file, hub, repo bank, watcher
│   ├── preload/index.ts     # contextBridge API
│   ├── renderer/            # React UI (10 pages)
│   └── shared/              # Types, defaults, utils
├── out/                     # Build output
├── release/                 # electron-builder output
├── data/                    # Created at runtime (dev)
├── logos/                   # Created at runtime from resources
└── settings.json            # Created at runtime
```
