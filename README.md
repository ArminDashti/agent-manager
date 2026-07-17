# Janus

Windows Electron app for managing **Skills**, **Rules**, **MCPs**, **Hooks**, **Sub-agents**, and **Tools** across AI platforms (Cursor, Antigravity, Codex, Grok, Copilot, Devin).

## Features

- Portable layout: `Janus.exe` + `settings.json` + `mcps/` + `logos/` + `data/`
- Local-first editing with **Edit (.md)** and **Preview (.md)** modes
- Public Hub catalog from `https://github.com/armindashti/janus-hub`
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

Install to a custom directory:

```bash
.\install.ps1 -Dir C:\Janus
```

Or manually:

```bash
npm install
npm run dist
```

Build output in `release/` (Janus.exe + settings.json only).

## Layout

```
Janus/
├── Janus.exe
├── settings.json
├── mcps/
├── logos/
└── data/
```
