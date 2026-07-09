# Agent Manager

Windows Electron desktop app for managing AI agent resources across multiple platforms.

## Purpose

- Discover and edit **Skills**, **Rules**, **MCPs**, **Hooks**, **Sub-agents**, and **Tools** from local platform paths and git projects
- **Local-first** editing: changes write directly to disk
- **Hub**: fetch public catalog from `armindashti.github.com/agent-manager-hub` via HTTP
- **Repo Bank**: personal git backup (fetch / commit & push)
- **Portable layout**: `AgentManager.exe` + `settings.json` + `logos/` + `data/`

## Platforms

Cursor (full: hooks + sub-agents), Cline, Kilo, Antigravity, Devin, Kiro (skills, rules, MCPs, tools).

## Stack

Electron 34, React 19, TypeScript, Tailwind CSS, CodeMirror 6, Zustand, simple-git, keytar.
