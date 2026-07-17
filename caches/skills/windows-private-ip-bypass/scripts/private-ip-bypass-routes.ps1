# Routes private (non-routable) IPv4 ranges through the physical LAN gateway,
# bypassing VPN tunnels such as Mullvad. Requires elevation for route changes.
#
# Pair with Mullvad "Local network sharing" enabled:
#   mullvad lan set allow

param(
    [string]$LanGateway,
    [string]$LanInterface,
    [switch]$IncludeCgnat,
    [switch]$ExcludeWifiDirectRanges,
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

$VpnAdapterPattern = 'Mullvad|VPN|OpenVPN|WireGuard|TAP|Tun|SoftEther|Proton|Windscribe|Wintun'

# RFC 1918 + link-local. CGNAT (100.64.0.0/10) is optional (Tailscale, ISP CGNAT).
$PrivateRoutes = @(
    @{ Network = '10.0.0.0';    Prefix = 8  },
    @{ Network = '172.16.0.0';  Prefix = 12 },
    @{ Network = '192.168.0.0'; Prefix = 16 },
    @{ Network = '169.254.0.0'; Prefix = 16 }
)

if ($IncludeCgnat) {
    $PrivateRoutes += @{ Network = '100.64.0.0'; Prefix = 10 }
}

# Mobile Hotspot and Wi-Fi Direct use 192.168.137.0/24 and 169.254.0.0/16 on the Wi-Fi
# adapter. Routing those ranges via Ethernet breaks Wi-Fi Direct / hotspot / Miracast.
if ($ExcludeWifiDirectRanges) {
    $PrivateRoutes = $PrivateRoutes | Where-Object {
        $_.Network -notin @('192.168.0.0', '169.254.0.0')
    }
}

function Convert-PrefixToMask([int]$PrefixLength) {
    $maskBytes = for ($octetIndex = 0; $octetIndex -lt 4; $octetIndex++) {
        $remainingBits = [Math]::Max([Math]::Min($PrefixLength - ($octetIndex * 8), 8), 0)
        if ($remainingBits -eq 0) { 0 } else { 256 - [Math]::Pow(2, 8 - $remainingBits) }
    }
    return ($maskBytes -join '.')
}

function Get-PhysicalDefaultRoute {
    Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
        Where-Object {
            $_.InterfaceAlias -notmatch $VpnAdapterPattern -and
            $_.NextHop -and
            $_.NextHop -ne '0.0.0.0'
        } |
        Sort-Object RouteMetric, ifMetric |
        Select-Object -First 1
}

function Add-PersistentPrivateRoute {
    param(
        [string]$Network,
        [int]$Prefix,
        [string]$Gateway,
        [int]$InterfaceIndex
    )

    $destination = "$Network/$Prefix"
    $mask = Convert-PrefixToMask -PrefixLength $Prefix

    $existing = Get-NetRoute -DestinationPrefix $destination -ErrorAction SilentlyContinue |
        Where-Object { $_.NextHop -eq $Gateway }

    if ($existing) {
        Write-Host "  route exists: $destination -> $Gateway"
        return
    }

    if ($WhatIf) {
        Write-Host "  would add: $Network mask $mask via $Gateway"
        return
    }

    Get-NetRoute -DestinationPrefix $destination -ErrorAction SilentlyContinue |
        Where-Object { $_.NextHop -ne $Gateway -and $_.NextHop -ne '0.0.0.0' } |
        ForEach-Object {
            Remove-NetRoute -DestinationPrefix $destination -NextHop $_.NextHop -Confirm:$false -ErrorAction SilentlyContinue
        }

    New-NetRoute -DestinationPrefix $destination -NextHop $Gateway -InterfaceIndex $InterfaceIndex -RouteMetric 1 -PolicyStore PersistentStore -ErrorAction SilentlyContinue | Out-Null
    & route.exe add $Network mask $mask $Gateway metric 1 if $InterfaceIndex -p | Out-Null
    Write-Host "  added: $destination -> $Gateway"
}

$physicalRoute = Get-PhysicalDefaultRoute
if (-not $physicalRoute) {
    Write-Warning 'No physical default route found. Connect to LAN or specify -LanGateway manually.'
    exit 1
}

$gateway = if ($LanGateway) { $LanGateway } else { $physicalRoute.NextHop }
$interfaceIndex = $physicalRoute.ifIndex
$interfaceAlias = if ($LanInterface) { $LanInterface } else { $physicalRoute.InterfaceAlias }

Write-Host "[*] Private IP VPN bypass routes"
Write-Host "    LAN gateway   : $gateway"
Write-Host "    LAN interface : $interfaceAlias"
Write-Host ""

Write-Host "[*] Adding persistent routes for private IPv4 ranges"
foreach ($route in $PrivateRoutes) {
    Add-PersistentPrivateRoute -Network $route.Network -Prefix $route.Prefix -Gateway $gateway -InterfaceIndex $interfaceIndex
}

if (-not $WhatIf) {
    Set-NetIPInterface -InterfaceAlias $interfaceAlias -InterfaceMetric 10 -ErrorAction SilentlyContinue

    $mullvadCli = @(
        "$env:ProgramFiles\Mullvad VPN\resources\mullvad.exe",
        "$env:ProgramFiles\Mullvad VPN\mullvad.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($mullvadCli) {
        & $mullvadCli lan set allow | Out-Null
        Write-Host ""
        Write-Host "[*] Mullvad local network sharing: allow"
    }
}

Write-Host ""
Write-Host "Done. Private IP traffic should bypass the VPN tunnel." -ForegroundColor Green
