---
name: wsl-bypass-vpn
description: >-
  Configure WSL on Windows to bypass VPN tunnels and use the physical LAN
  instead. Use when the user wants WSL traffic off VPN, WSL routing through
  Mullvad/Proton/OpenVPN/WireGuard, mirrored networking VPN issues, force WSL
  to use LAN IP, or asks to bypass VPN for a WSL distro.
---

# WSL Bypass VPN

Route WSL traffic through the physical LAN while Windows may still use VPN.

Skill scripts live in `.cursor/skills/wsl-bypass-vpn/scripts/` (project root).

## Quick apply (mirrored mode, preferred)

Run from the dopagent repo root. No admin required.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".cursor/skills/wsl-bypass-vpn/scripts/apply-wsl-bypass-vpn.ps1"
```

Optional: `-Distro Debian` for a non-default distro; `-SkipShutdown` to skip `wsl --shutdown`.

The script:

1. Writes `%USERPROFILE%\.wslconfig` with `networkingMode=mirrored` and `dnsTunneling=false`
2. Installs the skill routing script (LF line endings) into the distro
3. Removes legacy `/etc/default/wsl-bypass-vpn` if present
4. Enables `wsl-bypass-vpn.service` and `wsl-bypass-vpn.timer`
5. Compares WSL vs Windows public IPs

**Success:** WSL public IP differs from Windows VPN IP; default route uses the LAN gateway (e.g. `10.20.9.254`), not Mullvad (`10.64.0.1`).

## Choose an approach

| Goal | Approach | Admin required |
|------|----------|----------------|
| One or more specific distros bypass VPN | **Mirrored + per-distro routing script** (preferred) | No |
| All WSL distros bypass VPN | **NAT + Windows persistent routes** | Yes |

`.wslconfig` is global — `networkingMode` affects every distro. Per-distro bypass only works in **mirrored** mode via routing scripts inside each distro.

## Step 1: Diagnose

Run in parallel:

```powershell
wsl -l -v
Get-Content "$env:USERPROFILE\.wslconfig" -ErrorAction SilentlyContinue
Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Select-Object NextHop, InterfaceAlias, RouteMetric
```

Inside the target distro:

```powershell
wsl -d <Distro> -- wslinfo --networking-mode
wsl -d <Distro> -- ip -4 route
wsl -d <Distro> -- ip -4 addr show scope global
```

**VPN is winning inside WSL when:**
- `wslinfo --networking-mode` prints `mirrored`
- `ip -4 route` shows a VPN gateway (often `/32` tunnel address) as `default` with metric lower than LAN
- WSL public IP matches the VPN IP while Windows host IP also matches VPN

Compare public IPs:

```powershell
wsl -d <Distro> -- curl -s --max-time 10 https://api.ipify.org
(Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 10).Content
```

Bypass is working when these IPs differ and WSL shows the residential/LAN IP.

## Step 2A: Mirrored mode + per-distro bypass (preferred)

Use for specific distros (e.g. Debian only). Copy scripts from this skill:

- `scripts/wsl-bypass-vpn-debian.sh` → `/usr/local/bin/wsl-bypass-vpn.sh`
- `scripts/wsl-bypass-vpn.service` → `/etc/systemd/system/`
- `scripts/wsl-bypass-vpn.timer` → `/etc/systemd/system/`

### 2A.1 Update `.wslconfig`

Ensure mirrored mode and disable DNS tunneling (helps with VPN + WSL DNS issues):

```ini
[wsl2]
networkingMode=mirrored
dnsTunneling=false
```

Apply: `wsl --shutdown`, wait ~8s, restart the distro.

### 2A.2 Install routing script in the distro

**CRLF pitfall:** scripts created on Windows must use LF line endings or Linux reports `cannot execute: required file not found`.

```powershell
$skillRoot = Join-Path $PWD '.cursor/skills/wsl-bypass-vpn'
$src = Join-Path $skillRoot 'scripts/wsl-bypass-vpn-debian.sh'
$content = Get-Content -Raw $src
$content = $content -replace "`r`n", "`n"
$dest = "$env:USERPROFILE\scripts\wsl-bypass-vpn-debian.sh"
if (-not (Test-Path (Split-Path $dest))) { New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null }
[System.IO.File]::WriteAllText($dest, $content)

wsl -d <Distro> -u root -- bash -c "install -m 755 /mnt/c/Users/$env:USERNAME/scripts/wsl-bypass-vpn-debian.sh /usr/local/bin/wsl-bypass-vpn.sh"
```

Or install directly from the project via WSL mount (adjust drive letter/path as needed):

```powershell
wsl -d <Distro> -u root -- bash -c "sed -i 's/\r$//' /mnt/c/Users/$env:USERNAME/GitHub/dopagent/.cursor/skills/wsl-bypass-vpn/scripts/wsl-bypass-vpn-debian.sh && install -m 755 /mnt/c/Users/$env:USERNAME/GitHub/dopagent/.cursor/skills/wsl-bypass-vpn/scripts/wsl-bypass-vpn-debian.sh /usr/local/bin/wsl-bypass-vpn.sh"
```

### 2A.3 Enable systemd service + timer

Requires `systemd=true` in `/etc/wsl.conf`:

```ini
[boot]
systemd=true
command=/usr/local/bin/wsl-bypass-vpn.sh

[user]
default=<username>
```

```powershell
$skillScripts = Join-Path $PWD '.cursor/skills/wsl-bypass-vpn/scripts'
wsl -d <Distro> -u root -- bash -c "
  cp '$($skillScripts -replace '\\','/')'/wsl-bypass-vpn.service /etc/systemd/system/
  cp '$($skillScripts -replace '\\','/')'/wsl-bypass-vpn.timer /etc/systemd/system/
  systemctl enable --now wsl-bypass-vpn.service
  systemctl enable --now wsl-bypass-vpn.timer
"
```

Prefer the apply script over manual `bash -c` quoting. If installing units manually, pass the skill path literally (no `$SKILL` variable inside double-quoted PowerShell strings — PowerShell expands it):

```powershell
$skill = "/mnt/c/Users/$env:USERNAME/GitHub/dopagent/.cursor/skills/wsl-bypass-vpn/scripts"
wsl -d <Distro> -u root -- bash -c "cp $skill/wsl-bypass-vpn.service /etc/systemd/system/ && cp $skill/wsl-bypass-vpn.timer /etc/systemd/system/ && systemctl enable --now wsl-bypass-vpn.service wsl-bypass-vpn.timer"
```

The timer re-applies routes every 30s when VPN connects or reconnects while WSL is running.

### 2A.4 What the script does

1. Finds the physical LAN adapter (`192.168.x.x/24` or `10.x.x.x`, not `/32`)
2. Skips VPN-named interfaces and `/32` tunnel addresses
3. Deletes VPN default routes
4. Sets `default via <lan-gateway> dev <lan-iface> metric 1`

Matched VPN patterns: `mullvad`, `vpn`, `openvpn`, `wireguard`, `tap`, `tun`, `softether`, `proton`, `windscribe`, `wintun`.

## Step 2B: NAT mode + Windows routes (all distros)

Use when every WSL distro must bypass VPN.

### 2B.1 Update `.wslconfig`

```ini
[wsl2]
networkingMode=nat
dnsTunneling=false
```

Apply: `wsl --shutdown`.

### 2B.2 Install Windows route script (elevated)

Copy `scripts/wsl-bypass-vpn.ps1` to `%USERPROFILE%\scripts\`, or run from the skill directory.

Run in **elevated** PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".cursor/skills/wsl-bypass-vpn/scripts/wsl-bypass-vpn.ps1"
```

The script routes WSL NAT subnets (`172.16.0.0/12` on `vEthernet*`) through the physical gateway.

### 2B.3 Persist with scheduled task (elevated, once)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".cursor/skills/wsl-bypass-vpn/scripts/install-wsl-vpn-bypass-task.ps1"
```

Registers task `WSL Bypass VPN Routes` at logon/startup.

**If `New-NetRoute` fails with "Access is denied"** — the shell is not elevated. Tell the user to run the install script in an admin PowerShell session.

## Step 3: Verify

```powershell
wsl --shutdown
Start-Sleep -Seconds 4
wsl -d <Distro> -- ip -4 route
wsl -d <Distro> -- curl -s --max-time 10 https://api.ipify.org
(Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 10).Content
```

**Success criteria:**
- Default route points to LAN gateway (e.g. `192.168.1.1`), not VPN gateway
- `systemctl status wsl-bypass-vpn.service` shows `active (exited)` (mirrored approach)
- WSL public IP differs from Windows VPN IP

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `set: pipefail: invalid option name` | CRLF in bash invoked from PowerShell — use `apply-wsl-bypass-vpn.ps1` (writes LF install script) |
| `Nexthop has invalid gateway` | NAT mode or legacy custom script — run `apply-wsl-bypass-vpn.ps1`; do not point LAN gateway at `eth0` in NAT |
| Legacy script uses `/etc/default/wsl-bypass-vpn` | Replace with skill script; remove `/etc/default/wsl-bypass-vpn` |
| `cp: cannot stat '/wsl-bypass-vpn.service'` | PowerShell expanded `$SKILL` — use single-quoted `bash -c '...'` or the apply script |
| `wsl-bypass-vpn.service` failed / timer not-found | Reinstall units from skill `scripts/`; enable timer |
| VPN default route returns after connect | Ensure `wsl-bypass-vpn.timer` is enabled (mirrored) or scheduled task runs (NAT) |
| Boot script did not run | Use systemd service; `[boot] command` alone may run before interfaces are up |
| `Access is denied` on Windows routes | Run PowerShell elevated |
| NAT mode still uses VPN IP | Windows routes not applied — run `wsl-bypass-vpn.ps1` as admin |
| Only one distro should bypass | Use mirrored + per-distro script; do not switch to NAT for distro-only scope |
| `wslinfo` not found | WSL version too old — run `wsl --update` |

## Manual test (mirrored)

```powershell
wsl -d <Distro> -u root -- /usr/local/bin/wsl-bypass-vpn.sh
wsl -d <Distro> -- ip -4 route
```

Expected: `default via 192.168.x.1 dev ethX metric 1` (no VPN default route).

## Rollback

**Per-distro (mirrored):**

```powershell
wsl -d <Distro> -u root -- bash -c "
  systemctl disable --now wsl-bypass-vpn.timer wsl-bypass-vpn.service
  rm -f /etc/systemd/system/wsl-bypass-vpn.{service,timer} /usr/local/bin/wsl-bypass-vpn.sh
  systemctl daemon-reload
"
```

Remove `command=` line from `/etc/wsl.conf`, then `wsl --shutdown`.

**Windows routes (NAT):**

```powershell
Unregister-ScheduledTask -TaskName 'WSL Bypass VPN Routes' -Confirm:$false -ErrorAction SilentlyContinue
```

Remove `networkingMode` override from `.wslconfig` if desired, then `wsl --shutdown`.

## Scripts in this skill

| File | Purpose |
|------|---------|
| [scripts/apply-wsl-bypass-vpn.ps1](scripts/apply-wsl-bypass-vpn.ps1) | **One-shot apply** — mirrored mode + distro install + verify |
| [scripts/wsl-bypass-vpn-debian.sh](scripts/wsl-bypass-vpn-debian.sh) | Per-distro routing fix (mirrored mode) |
| [scripts/wsl-bypass-vpn.service](scripts/wsl-bypass-vpn.service) | systemd oneshot unit |
| [scripts/wsl-bypass-vpn.timer](scripts/wsl-bypass-vpn.timer) | Re-apply routes every 30s |
| [scripts/wsl-bypass-vpn.ps1](scripts/wsl-bypass-vpn.ps1) | Windows route fix (NAT mode) |
| [scripts/install-wsl-vpn-bypass-task.ps1](scripts/install-wsl-vpn-bypass-task.ps1) | Registers elevated scheduled task |

## Verified on this machine (Jun 2026)

- VPN: Mullvad (`10.64.0.1` default on Windows)
- LAN: `Ethernet 2`, gateway `10.20.9.254`, host `10.20.9.59`
- Distro: Debian, mirrored mode, `eth1` = LAN, `eth0` = Mullvad `/32`
- After apply: WSL public IP ≠ Windows VPN IP; default route `via 10.20.9.254 dev eth1 metric 1`
