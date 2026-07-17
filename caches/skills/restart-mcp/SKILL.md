---
name: restart-mcp
description: >-
  Restart MCP servers in Cursor on Windows. Use when the user asks to restart
  MCP, an MCP server shows "Not connected", tools are missing after config or
  env changes, agent mcp list shows not loaded/needs approval, or any MCP tool
  call fails with connection errors.
---

# Restart MCP Servers in Cursor

## When to use

- User asks to restart MCP (one server or all)
- MCP tools return `Not connected` or are absent from the session
- `agent mcp list` shows `not loaded` or `needs approval`
- Server config, env vars, or external config files changed and tools are stale
- A stdio MCP process died and Cursor did not respawn it

## Identify the server

Server **identifier** matches the key in `~/.cursor/mcp.json` under `mcpServers`.

Configured on this machine:

| Identifier | Type |
|------------|------|
| `desktop-commander` | stdio (npx) |
| `github` | remote URL |
| `sequential-thinking` | stdio (npx) |
| `ssh-mcp` | stdio (npx) |
| `supabase` | remote URL |
| `windows-mcp` | stdio (uvx) |
| `Mobile MCP` | stdio (npx) |

In Agent tool calls, user-scoped servers appear prefixed (e.g. `user-ssh-mcp`); the CLI identifier is still `ssh-mcp`.

## Preferred method (single server)

Replace `<identifier>` with the server name from `mcp.json`:

```powershell
agent mcp disable <identifier>
Start-Sleep -Seconds 2
agent mcp enable <identifier>
Start-Sleep -Seconds 4
agent mcp list
```

Expect `<identifier>: ready` in the output.

## Restart all configured servers

```powershell
$servers = @(
  "desktop-commander",
  "github",
  "sequential-thinking",
  "ssh-mcp",
  "supabase",
  "windows-mcp",
  "Mobile MCP"
)
foreach ($s in $servers) {
  agent mcp disable $s 2>$null
}
Start-Sleep -Seconds 2
foreach ($s in $servers) {
  agent mcp enable $s
}
Start-Sleep -Seconds 4
agent mcp list
```

Skip servers the user did not ask to restart when only one is failing.

## Verify restart

1. **CLI status**
   ```powershell
   agent mcp list
   ```

2. **MCP tool smoke test** — call any simple tool on the restarted server (e.g. `list-servers` on `user-ssh-mcp`, `list_processes` on desktop-commander).

3. **Process check** (stdio servers only, optional)
   ```powershell
   Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='python.exe'" |
     Where-Object { $_.CommandLine -like '*<package-or-command>*' } |
     Select-Object ProcessId, @{N='Cmd';E={$_.CommandLine.Substring(0,[Math]::Min(120,$_.CommandLine.Length))}}
   ```

## UI fallback

1. `Ctrl + Shift + J` → **Tools & MCP**
2. Toggle the target server off → wait 2–3 seconds → toggle on
3. Optional: `Ctrl + Shift + U` → **MCP Logs**
4. Start a **new Agent chat** if tools still do not appear in the current session

## Last resort

`Ctrl + Shift + P` → **Developer: Reload Window**

Reloads the entire Cursor window. Use when disable/enable did not restore tools.

## Server-specific notes

| Server | Extra config | Restart when |
|--------|--------------|--------------|
| `ssh-mcp` | `~/.cursor/ssh-mcp-config.json` | Hosts added/removed/changed |
| `github` | `GITHUB_PAT_TOKEN` env var | Token rotated |
| `supabase` | URL / project ref in `mcp.json` | Project or auth changed |
| `windows-mcp` | `WINDOWS_MCP_SCREENSHOT_SCALE` in `mcp.json` | Env or args changed |

Do not print or log secret config files (`ssh-mcp-config.json`, tokens).

## Do not

- **Do not** kill MCP child processes without re-enabling via CLI or UI — Cursor may not respawn them
- **Do not** edit `mcp.json` only to force a reload unless the server definition itself changed
- **Do not** restart all servers when only one is broken (unless the user asks)

## Troubleshooting

| Symptom | Action |
|---------|--------|
| `not loaded (needs approval)` | `agent mcp enable <identifier>` |
| CLI says `ready` but current chat still fails | New Agent chat or **Developer: Reload Window** |
| Remote URL server fails | Check env vars, network, and MCP Logs |
| Still broken | Remove and re-add server in **Tools & MCP**, or fully quit and reopen Cursor |

## Report to user

After restart, confirm:

- Which server(s) were restarted
- `agent mcp list` status for each
- Smoke-test tool result (if applicable)
- Whether a new chat or window reload was needed
