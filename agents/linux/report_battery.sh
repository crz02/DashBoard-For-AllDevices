#!/bin/bash
# ==========================================================================
# Statuser — Linux Battery Reporter
# Reports battery, CPU, and RAM telemetry to your Statuser dashboard.
# Uses standard Linux sysfs (/sys/class/power_supply/) and /proc.
#
# Usage:
#   ./report_battery.sh <DASHBOARD_URL> [DEVICE_ID] [--user-id <USER_ID>]
#   ./report_battery.sh --install <DASHBOARD_URL> [DEVICE_ID] [--user-id <USER_ID>]
#   ./report_battery.sh --uninstall
#
# Tested on: Ubuntu 22.04+, Fedora 38+, Debian 12+, Arch Linux, Pop!_OS
# ==========================================================================

set -euo pipefail

SERVICE_NAME="statuser-battery"
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

# ── Parse arguments ──────────────────────────────────────────────────────

ACTION="report"
DASHBOARD_URL=""
DEVICE_ID=""
USER_ID=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --install)
            ACTION="install"
            shift
            ;;
        --uninstall)
            ACTION="uninstall"
            shift
            ;;
        --user-id)
            USER_ID="$2"
            shift 2
            ;;
        -h|--help)
            echo "Statuser Linux Battery Reporter"
            echo ""
            echo "Usage:"
            echo "  ./report_battery.sh <URL> [DEVICE_ID] [--user-id <ID>]"
            echo "  ./report_battery.sh --install <URL> [DEVICE_ID] [--user-id <ID>]"
            echo "  ./report_battery.sh --uninstall"
            echo ""
            echo "Options:"
            echo "  --user-id <ID>   Associate reports with a specific user account"
            echo "  --install        Create a systemd timer to report every 5 minutes"
            echo "  --uninstall      Remove the systemd timer and service"
            exit 0
            ;;
        *)
            if [[ -z "$DASHBOARD_URL" ]]; then
                DASHBOARD_URL="$1"
            elif [[ -z "$DEVICE_ID" ]]; then
                DEVICE_ID="$1"
            fi
            shift
            ;;
    esac
done

# ── Uninstall ────────────────────────────────────────────────────────────

if [[ "$ACTION" == "uninstall" ]]; then
    echo "Removing Statuser systemd timer..."
    systemctl --user stop "${SERVICE_NAME}.timer" 2>/dev/null || true
    systemctl --user disable "${SERVICE_NAME}.timer" 2>/dev/null || true
    rm -f "$HOME/.config/systemd/user/${SERVICE_NAME}.service"
    rm -f "$HOME/.config/systemd/user/${SERVICE_NAME}.timer"
    systemctl --user daemon-reload 2>/dev/null || true
    echo "✓ Uninstalled. Battery reporting stopped."
    exit 0
fi

# ── Validate URL ─────────────────────────────────────────────────────────

if [[ -z "$DASHBOARD_URL" ]]; then
    echo "Error: Dashboard URL is required."
    echo "Usage: ./report_battery.sh <DASHBOARD_URL> [DEVICE_ID]"
    echo "       ./report_battery.sh --install <DASHBOARD_URL>"
    exit 1
fi

# Strip trailing slash
DASHBOARD_URL="${DASHBOARD_URL%/}"

# ── Install (systemd user timer) ─────────────────────────────────────────

if [[ "$ACTION" == "install" ]]; then
    DEVICE_ID="${DEVICE_ID:-$(hostname -s | tr '[:upper:]' '[:lower:]')}"

    SYSTEMD_DIR="$HOME/.config/systemd/user"
    mkdir -p "$SYSTEMD_DIR"

    # Build ExecStart command
    EXEC_CMD="$SCRIPT_PATH ${DASHBOARD_URL} ${DEVICE_ID}"
    if [[ -n "$USER_ID" ]]; then
        EXEC_CMD="$EXEC_CMD --user-id ${USER_ID}"
    fi

    # Create service file
    cat > "$SYSTEMD_DIR/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Statuser Battery Reporter
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=${EXEC_CMD}
EOF

    # Create timer file
    cat > "$SYSTEMD_DIR/${SERVICE_NAME}.timer" <<EOF
[Unit]
Description=Statuser Battery Reporter Timer (every 5 minutes)

[Timer]
OnBootSec=30
OnUnitActiveSec=5min
AccuracySec=30

[Install]
WantedBy=timers.target
EOF

    # Enable and start
    systemctl --user daemon-reload
    systemctl --user enable "${SERVICE_NAME}.timer"
    systemctl --user start "${SERVICE_NAME}.timer"

    echo "✓ Statuser systemd timer installed!"
    echo "  Reporting every 5 minutes to: $DASHBOARD_URL"
    echo "  Device ID: $DEVICE_ID"
    [[ -n "$USER_ID" ]] && echo "  User ID: $USER_ID"
    echo ""
    echo "  Check status: systemctl --user status ${SERVICE_NAME}.timer"
    echo "  To uninstall: ./report_battery.sh --uninstall"
    exit 0
fi

# ── Report battery telemetry ─────────────────────────────────────────────

DEVICE_ID="${DEVICE_ID:-$(hostname -s | tr '[:upper:]' '[:lower:]')}"
DEVICE_NAME="$(hostname -s)"

# Detect distribution for model string
if [[ -f /etc/os-release ]]; then
    MODEL="$(. /etc/os-release && echo "${PRETTY_NAME:-Linux}")"
else
    MODEL="Linux"
fi

# ── Battery info from sysfs ──────────────────────────────────────────────

# Find the first battery in /sys/class/power_supply/
BATTERY_PATH=""
for bat in /sys/class/power_supply/BAT*; do
    if [[ -d "$bat" ]]; then
        BATTERY_PATH="$bat"
        break
    fi
done

if [[ -z "$BATTERY_PATH" ]]; then
    # No battery found — desktop/server
    PERCENTAGE=100
    IS_CHARGING="true"
    POWER_SOURCE="AC Power (Desktop)"
    HEALTH_STR="N/A (Desktop)"
else
    # Read battery percentage
    if [[ -f "$BATTERY_PATH/capacity" ]]; then
        PERCENTAGE=$(cat "$BATTERY_PATH/capacity" 2>/dev/null || echo "100")
    else
        PERCENTAGE=100
    fi

    # Read charging status
    STATUS=$(cat "$BATTERY_PATH/status" 2>/dev/null || echo "Unknown")
    case "$STATUS" in
        Charging)
            IS_CHARGING="true"
            POWER_SOURCE="AC Power"
            ;;
        Discharging)
            IS_CHARGING="false"
            POWER_SOURCE="Battery"
            ;;
        Full)
            IS_CHARGING="false"
            POWER_SOURCE="AC Power"
            ;;
        *)
            IS_CHARGING="false"
            POWER_SOURCE="Unknown"
            ;;
    esac

    # Battery health (if available)
    if [[ -f "$BATTERY_PATH/energy_full" && -f "$BATTERY_PATH/energy_full_design" ]]; then
        ENERGY_FULL=$(cat "$BATTERY_PATH/energy_full" 2>/dev/null || echo "0")
        ENERGY_DESIGN=$(cat "$BATTERY_PATH/energy_full_design" 2>/dev/null || echo "1")
        if [[ "$ENERGY_DESIGN" -gt 0 ]]; then
            HEALTH_PCT=$(echo "scale=0; ($ENERGY_FULL * 100) / $ENERGY_DESIGN" | bc 2>/dev/null || echo "100")
            HEALTH_STR="${HEALTH_PCT}%"
        else
            HEALTH_STR="Good"
        fi
    elif [[ -f "$BATTERY_PATH/charge_full" && -f "$BATTERY_PATH/charge_full_design" ]]; then
        CHARGE_FULL=$(cat "$BATTERY_PATH/charge_full" 2>/dev/null || echo "0")
        CHARGE_DESIGN=$(cat "$BATTERY_PATH/charge_full_design" 2>/dev/null || echo "1")
        if [[ "$CHARGE_DESIGN" -gt 0 ]]; then
            HEALTH_PCT=$(echo "scale=0; ($CHARGE_FULL * 100) / $CHARGE_DESIGN" | bc 2>/dev/null || echo "100")
            HEALTH_STR="${HEALTH_PCT}%"
        else
            HEALTH_STR="Good"
        fi
    else
        HEALTH_STR="Good"
    fi
fi

# ── CPU usage from /proc/stat ────────────────────────────────────────────

# Sample CPU twice with a short interval for accurate reading
read_cpu_stats() {
    awk '/^cpu / {print $2+$3+$4+$5+$6+$7+$8, $5}' /proc/stat
}

CPU1=($(read_cpu_stats))
sleep 0.5
CPU2=($(read_cpu_stats))

CPU_TOTAL_DIFF=$((${CPU2[0]} - ${CPU1[0]}))
CPU_IDLE_DIFF=$((${CPU2[1]} - ${CPU1[1]}))

if [[ "$CPU_TOTAL_DIFF" -gt 0 ]]; then
    CPU_USAGE=$(echo "scale=1; (($CPU_TOTAL_DIFF - $CPU_IDLE_DIFF) * 100) / $CPU_TOTAL_DIFF" | bc 2>/dev/null || echo "0")
else
    CPU_USAGE="0"
fi

# ── RAM usage from /proc/meminfo ─────────────────────────────────────────

MEM_TOTAL=$(grep MemTotal /proc/meminfo | awk '{print $2}')
MEM_AVAILABLE=$(grep MemAvailable /proc/meminfo | awk '{print $2}')

if [[ "$MEM_TOTAL" -gt 0 ]]; then
    RAM_USAGE=$(echo "scale=1; (($MEM_TOTAL - $MEM_AVAILABLE) * 100) / $MEM_TOTAL" | bc 2>/dev/null || echo "0")
else
    RAM_USAGE="0"
fi

# ── Temperature (if available) ───────────────────────────────────────────

TEMP="0"
if [[ -f "$BATTERY_PATH/temp" ]] 2>/dev/null; then
    RAW_TEMP=$(cat "$BATTERY_PATH/temp" 2>/dev/null || echo "0")
    TEMP=$(echo "scale=1; $RAW_TEMP / 10" | bc 2>/dev/null || echo "0")
elif command -v sensors &>/dev/null; then
    TEMP=$(sensors 2>/dev/null | grep -i "Package id 0\|Tctl" | head -1 | grep -oE '[0-9]+\.[0-9]+' | head -1 || echo "0")
fi

# ── Build and send payload ───────────────────────────────────────────────

PERCENTAGE=${PERCENTAGE:-100}
CPU_USAGE=${CPU_USAGE:-0}
RAM_USAGE=${RAM_USAGE:-0}

JSON_PAYLOAD=$(cat <<EOF
{
  "device_id": "${DEVICE_ID}",
  "name": "${DEVICE_NAME}",
  "platform": "linux",
  "model": "${MODEL}",
  "battery_level": ${PERCENTAGE},
  "is_charging": ${IS_CHARGING},
  "power_source": "${POWER_SOURCE}",
  "battery_health": "${HEALTH_STR}",
  "temperature": ${TEMP},
  "cpu_usage": ${CPU_USAGE},
  "ram_usage": ${RAM_USAGE}
}
EOF
)

# Build curl headers
CURL_HEADERS=(-H "Content-Type: application/json")
if [[ -n "$USER_ID" ]]; then
    CURL_HEADERS+=(-H "X-User-Id: ${USER_ID}")
fi

echo "Reporting to ${DASHBOARD_URL}/api/report..."
curl -s -X POST "${DASHBOARD_URL}/api/report" \
     "${CURL_HEADERS[@]}" \
     -d "$JSON_PAYLOAD"

echo ""
echo "✓ Reported: ${DEVICE_NAME} (${MODEL}) — ${PERCENTAGE}%"
