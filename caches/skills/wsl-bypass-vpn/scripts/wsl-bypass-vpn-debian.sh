#!/bin/bash
# Prefer the physical LAN default route over VPN tunnels inside WSL mirrored networking.
set -euo pipefail

vpn_pattern='(mullvad|vpn|openvpn|wireguard|tap|tun|softether|proton|windscribe|wintun)'

physical_dev=''
physical_gw=''

for dev in $(ls /sys/class/net/ | grep -v '^lo$'); do
    if echo "$dev" | grep -Eiq "$vpn_pattern"; then
        continue
    fi

    lan_addr="$(ip -4 addr show dev "$dev" scope global 2>/dev/null | awk '/inet / {print $2; exit}')"
    [ -z "$lan_addr" ] && continue

    if [[ "$lan_addr" == */32 ]]; then
        continue
    fi

    if [[ "$lan_addr" =~ ^192\.168\. ]] || { [[ "$lan_addr" =~ ^10\. ]] && [[ ! "$lan_addr" =~ ^10\.64\. ]]; }; then
        physical_dev="$dev"
        physical_gw="$(ip -4 route show dev "$dev" | awk '/^default / {print $3; exit}')"
        if [ -z "$physical_gw" ]; then
            IFS=. read -r o1 o2 o3 _ <<< "${lan_addr%/*}"
            physical_gw="${o1}.${o2}.${o3}.1"
        fi
        break
    fi
done

if [ -z "$physical_dev" ] || [ -z "$physical_gw" ]; then
    exit 0
fi

while read -r line; do
    dev="$(sed -n 's/.* dev \([^ ]*\).*/\1/p' <<< "$line")"
    [ "$dev" = "$physical_dev" ] && continue

    if echo "$dev" | grep -Eiq "$vpn_pattern"; then
        gw="$(awk '/via/ {print $3}' <<< "$line")"
        if [ -n "$gw" ]; then
            ip route del default via "$gw" dev "$dev" 2>/dev/null || true
        else
            ip route del default dev "$dev" 2>/dev/null || true
        fi
        continue
    fi

    addr_prefix="$(ip -4 addr show dev "$dev" scope global 2>/dev/null | awk '/inet / {print $2; exit}')"
    if [[ "$addr_prefix" == */32 ]]; then
        gw="$(awk '/via/ {print $3}' <<< "$line")"
        if [ -n "$gw" ]; then
            ip route del default via "$gw" dev "$dev" 2>/dev/null || true
        else
            ip route del default dev "$dev" 2>/dev/null || true
        fi
    fi
done < <(ip -4 route show type unicast | grep '^default')

ip route replace default via "$physical_gw" dev "$physical_dev" metric 1 2>/dev/null || \
    ip route add default via "$physical_gw" dev "$physical_dev" metric 1 2>/dev/null || true
