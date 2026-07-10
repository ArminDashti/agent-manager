# Janus

Windows Electron desktop app for managing AI agent resources across multiple platforms.

## Purpose

- Discover and edit **Skills**, **Rules**, **MCPs**, **Hooks**, **Sub-agents**, and **Tools** from local platform paths and git projects
- **Local-first** editing: changes write directly to disk
- **Hub**: fetch public catalog from `https://github.com/armindashti/praktoras-hub` via HTTP
- **Repo Bank** (UI: **Git Backup**): personal git backup (pull / commit & push); optional auto-sync every 30 minutes (pull then push)
- **Portable layout**: `Janus.exe` + `settings.json` + `logos/` + `data/`
- **Project-only loading**: Skills, Hooks, Rules, and Sub-agents are discovered only from imported git projects (`.cursor` dirs), not platform roots

## Platforms

Antigravity, Cline, Copilot, Cursor, Devin, Hermes, Kilo, Kiro. Cursor supports hooks and sub-agents; others support skills, rules, MCPs, and tools at platform level (MCPs/tools only for platform scan).

## Stack

Electron 34, React 19, TypeScript, Tailwind CSS, CodeMirror 6, Zustand, simple-git, keytar.

## Build

- `npm run dist` — build and export portable `Janus.exe` to `release/`
- `.\install.ps1` — clear `release/` then run `npm run dist`
