# Janus

Windows Electron app for managing **Skills**, **Rules**, **MCPs**, **Hooks**, **Sub-agents**, and **Tools** across AI platforms (Cursor, Cline, Kilo, Antigravity, Devin, Kiro).

## Features

- Portable layout: `Janus.exe` + `settings.json` + `logos/` + `data/`
- Local-first editing with **Edit (.md)** and **Preview (.md)** modes
- Public Hub catalog from `armindashti.github.com/agent-manager-hub`
- Personal Repo Bank backup via git
- Hooks and Sub-agents: **Cursor only** (v1)

## Development

```bash
npm install
npm run dev
```

## Build portable Windows app

```bash
.\install.ps1
```

Or manually:

```bash
npm install
npm run dist
```

Output in `release/`.

## Layout

```
Janus/
├── Janus.exe
├── settings.json
├── logos/
└── data/
```
