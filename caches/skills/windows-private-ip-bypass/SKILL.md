---
name: windows-private-ip-bypass
description: >-
  Route all private IPv4 traffic around VPN tunnels on Windows (Mullvad, etc.).
  Use when the user wants LAN/private IP bypass, RFC 1918 split routing, local
  network sharing, or company/home network access while VPN is connected.
---

# Windows Private IP VPN Bypass

Keep traffic to private (non-routable) IPv4 addresses off the VPN tunnel on Windows while public internet traffic stays encrypted.

Skill scripts live in `.cursor/skills/windows-private-ip-bypass/scripts/`.

## How it works (two layers)

| Layer | What | Why |
|-------|------|-----|
| **Mullvad firewall** | Local network sharing (`mullvad lan set allow`) | Mullvad's kill switch blocks LAN traffic unless this is enabled |
| **Windows routing** | Persistent routes via physical LAN gateway | VPN default route captures everything; more-specific private routes must point at the LAN router |

Mullvad does **not** offer IP-range split tunneling in its GUI. It relies on Windows routing plus local network sharing. See [Mullvad local network access](https://mullvad-mullvadvpn-app.mintlify.app/features/local-network-access).

## Private IP ranges covered

| Range | CIDR | Purpose |
|-------|------|---------|
| Class A private | `10.0.0.0/8` | Large LANs, corporate networks |
| Class B private | `172.16.0.0/12` | Medium LANs, Docker/WSL NAT |
| Class C private | `192.168.0.0/16` | Home WiFi |
| Link-local | `169.254.0.0/16` | APIPA, device auto-config |
| CGNAT (optional) | `100.64.0.0/10` | Tailscale, ISP CGNAT — use `-IncludeCgnat` |
| IPv6 localhost | `::1/128` | Windows **system** route on loopback — always on-link, not listed under `Persistent Routes` |

**Note:** Mullvad's own tunnel gateway (`10.64.0.1`) lives inside `10.0.0.0/8` but has more-specific `/32` on-link routes on the Mullvad adapter, so the VPN tunnel itself is unaffected.

`::1/128` does not need a manual persistent route. Windows creates it as a **System** route on `Loopback Pseudo-Interface 1` at every boot. In `route print -6`, an empty **Persistent Routes** section is normal for IPv6 localhost — check the **Active Routes** line instead:

For subnets behind your router (e.g. `192.168.23.0/24` reachable via `192.168.0.1`), add extra routes as needed — Mullvad cannot auto-discover remote LAN segments.

## Step 1: Diagnose

```powershell
Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Select-Object NextHop, InterfaceAlias, RouteMetric
route print -4 | Select-String '10\.|172\.|192\.168|169\.254|100\.64|0\.0\.0\.0'
& "$env:ProgramFiles\Mullvad VPN\resources\mullvad.exe" lan get
& "$env:ProgramFiles\Mullvad VPN\resources\mullvad.exe" status
```

**Bypass is working when:**
- Private-range routes point to your LAN gateway (e.g. `10.20.9.254`), not the VPN gateway (`10.64.0.1`)
- `route print -6` shows `::1/128` on-link via interface `1` (loopback), not the Mullvad adapter
- `mullvad lan get` shows `allow`
- `ping 192.168.x.x` or company LAN hosts succeed while VPN is connected
- Public IP check still shows VPN exit: `(Invoke-WebRequest https://api.ipify.org -UseBasicParsing).Content`

## Step 2: Apply routes (elevated PowerShell)

**After a network reset** — run the all-in-one reapply script (private routes + company LAN + verification):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".cursor/skills/windows-private-ip-bypass/scripts/reapply-private-ip-vpn-bypass.ps1" -InstallTask
```

From the dopagent repo root (routes only):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".cursor/skills/windows-private-ip-bypass/scripts/private-ip-bypass-routes.ps1" -IncludeCgnat
```

Auto-detects the physical LAN gateway. Override if needed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".cursor/skills/windows-private-ip-bypass/scripts/private-ip-bypass-routes.ps1" `
  -LanGateway "10.20.9.254" -LanInterface "Ethernet 2" -IncludeCgnat
```

Preview without changes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".cursor/skills/windows-private-ip-bypass/scripts/private-ip-bypass-routes.ps1" -WhatIf
```

## Step 3: Persist with scheduled task (elevated, once)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".cursor/skills/windows-private-ip-bypass/scripts/install-private-ip-bypass-task.ps1"
```

Registers task `Private IP VPN Bypass Routes` at logon/startup. Re-applies routes after VPN reconnect.

## Mullvad manual steps

If Mullvad CLI is unavailable:

1. Open **Mullvad VPN** → **Settings** → **VPN settings**
2. Enable **Local network sharing** (also called "Allow LAN")
3. No reconnect required — firewall rules update immediately

CLI equivalent:

```powershell
& "$env:ProgramFiles\Mullvad VPN\resources\mullvad.exe" lan set allow
```

**Security note:** Only enable local network sharing on trusted networks (home, office). Disable on public WiFi:

```powershell
& "$env:ProgramFiles\Mullvad VPN\resources\mullvad.exe" lan set block
```

## WSL (optional)

Windows private-IP routes help WSL in **NAT** mode. For **mirrored** mode with per-distro bypass, use the [`wsl-bypass-vpn`](../wsl-bypass-vpn/SKILL.md) skill instead.

Recommended `.wslconfig` when using WSL bypass:

```ini
[wsl2]
networkingMode=mirrored
dnsTunneling=false
```

## Company LAN extras

This machine also has `~\scripts\company-lan-vpn-bypass.ps1` with company-specific NRPT DNS rules for `dpdc.local`. Run that **in addition** when company DNS/domain resolution is needed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\scripts\company-lan-vpn-bypass.ps1"
```

## Verify

```powershell
# Routes should show LAN gateway for private ranges
route print -4 | Select-String '10\.0\.0\.0|172\.16\.0\.0|192\.168\.0\.0|169\.254\.0\.0|100\.64\.0\.0'

# IPv6 localhost — Active Routes should show ::1/128 on-link (Persistent Routes may be empty)
route print -6 | Select-String '::1'
netsh interface ipv6 show route level=verbose store=active | Select-String '::1/128' -Context 0,4
ping -6 -n 1 ::1

# Mullvad LAN sharing
& "$env:ProgramFiles\Mullvad VPN\resources\mullvad.exe" lan get

# Public traffic still via VPN
(Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 10).Content

# Private LAN reachable (adjust target)
ping -n 2 10.20.9.254
ping -n 2 192.168.1.1
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Localhost IPv6 fails with VPN on | Confirm `::1/128` is on-link in Active Routes; if split-tunnel excludes the app, bind UDP sockets to `127.0.0.1` explicitly (Mullvad limitation) |
| VS deploy to localhost fails (404) | IIS site may be bound to LAN IP only (`10.20.9.59:80`), not `localhost`. Use `http://10.20.9.59/` in publish profile, or run [add-iis-localhost-binding.ps1](scripts/add-iis-localhost-binding.ps1) elevated |
| Private pings fail with VPN on | Enable Mullvad LAN sharing; re-run route script elevated |
| Routes disappear after VPN reconnect | Install scheduled task (Step 3) |
| Remote subnet unreachable | Add explicit route: `route -p add <subnet> mask <mask> <lan-gateway>` |
| `Access is denied` on routes | Run PowerShell as Administrator |
| WSL still shows VPN IP | Use `wsl-bypass-vpn` skill (mirrored mode) |
| Company DNS fails | Run `company-lan-vpn-bypass.ps1`; consider `-FixMullvadDns` |
| Wi-Fi Direct / Mobile Hotspot missing or broken | Private bypass routes for `192.168.0.0/16` and `169.254.0.0/16` steal hotspot/link-local traffic to Ethernet. Re-run routes with `-ExcludeWifiDirectRanges` or remove those two routes |

## Rollback

```powershell
Unregister-ScheduledTask -TaskName 'Private IP VPN Bypass Routes' -Confirm:$false -ErrorAction SilentlyContinue

# Remove persistent private routes (adjust gateway if different)
$gw = '10.20.9.254'
route -p delete 10.0.0.0 mask 255.0.0.0 $gw
route -p delete 172.16.0.0 mask 255.240.0.0 $gw
route -p delete 192.168.0.0 mask 255.255.0.0 $gw
route -p delete 169.254.0.0 mask 255.255.0.0 $gw
route -p delete 100.64.0.0 mask 255.192.0.0 $gw

& "$env:ProgramFiles\Mullvad VPN\resources\mullvad.exe" lan set block
```

## Scripts

| File | Purpose |
|------|---------|
| [scripts/reapply-private-ip-vpn-bypass.ps1](scripts/reapply-private-ip-vpn-bypass.ps1) | Full reapply after network reset (routes + company LAN + verify) |
| [scripts/private-ip-bypass-routes.ps1](scripts/private-ip-bypass-routes.ps1) | Add persistent private-IP routes via LAN gateway |
| [scripts/install-private-ip-bypass-task.ps1](scripts/install-private-ip-bypass-task.ps1) | Register elevated logon/startup scheduled task |
| [scripts/add-iis-localhost-binding.ps1](scripts/add-iis-localhost-binding.ps1) | Add `*:80:localhost` binding to the IIS site on the LAN IP (elevated) |
