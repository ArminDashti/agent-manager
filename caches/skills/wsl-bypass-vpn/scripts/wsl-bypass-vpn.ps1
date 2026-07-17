# Routes WSL NAT traffic through the physical LAN gateway, bypassing VPN tunnels.
# Run after VPN connect/disconnect and at logon. Requires elevation for route changes.

$ErrorActionPreference = 'Stop'

$VpnAdapterPattern = 'Mullvad|VPN|OpenVPN|WireGuard|TAP|Tun|SoftEther|Proton|Windscribe|Wintun'

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

function Get-WslNatSubnets {
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.InterfaceAlias -like 'vEthernet*' -and
            $_.IPAddress -match '^172\.(1[6-9]|2[0-9]|3[0-1])\.' -and
            $_.InterfaceAlias -notmatch $VpnAdapterPattern
        }
}

$physicalRoute = Get-PhysicalDefaultRoute
if (-not $physicalRoute) {
    Write-Warning 'No physical default route found. Skipping WSL VPN bypass routes.'
    exit 0
}

$gateway = $physicalRoute.NextHop
$interfaceIndex = $physicalRoute.ifIndex
$interfaceAlias = $physicalRoute.InterfaceAlias

$wslSubnets = Get-WslNatSubnets
if (-not $wslSubnets) {
    $wslSubnets = @([pscustomobject]@{
        IPAddress      = '172.16.0.0'
        PrefixLength   = 12
        InterfaceAlias = 'vEthernet (WSL fallback)'
    })
}

foreach ($subnet in $wslSubnets) {
    $destination = if ($subnet.PrefixLength) {
        "$($subnet.IPAddress)/$($subnet.PrefixLength)"
    } else {
        $subnet.IPAddress
    }

    $existing = Get-NetRoute -DestinationPrefix $destination -ErrorAction SilentlyContinue |
        Where-Object { $_.NextHop -eq $gateway -and $_.ifIndex -eq $interfaceIndex }

    if ($existing) {
        Write-Host "Route already present: $destination -> $gateway via $interfaceAlias"
        continue
    }

    Get-NetRoute -DestinationPrefix $destination -ErrorAction SilentlyContinue |
        Where-Object { $_.ifIndex -ne $interfaceIndex } |
        ForEach-Object {
            Remove-NetRoute -DestinationPrefix $destination -NextHop $_.NextHop -Confirm:$false -ErrorAction SilentlyContinue
        }

    New-NetRoute -DestinationPrefix $destination -NextHop $gateway -InterfaceIndex $interfaceIndex -RouteMetric 1 -ErrorAction Stop | Out-Null
    Write-Host "Added route: $destination -> $gateway via $interfaceAlias"

    if ($destination -match '^([0-9.]+)/(\d+)$') {
        $network = $Matches[1]
        $prefix = [int]$Matches[2]
        $mask = switch ($prefix) {
            12 { '255.240.0.0' }
            20 { '255.255.240.0' }
            24 { '255.255.255.0' }
            default {
                $maskBits = ('1' * $prefix).PadRight(32, '0')
                $octets = 0..3 | ForEach-Object {
                    [convert]::ToInt32($maskBits.Substring($_ * 8, 8), 2)
                }
                ($octets -join '.')
            }
        }
        & route.exe add $network mask $mask $gateway metric 1 if $interfaceIndex -p | Out-Null
    }
}
