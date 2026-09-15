#!/bin/bash
# ==========================================================================
# Statuser — macOS Battery Reporter
# Reports battery, health, CPU, and RAM telemetry to your Statuser dashboard.
#
# Usage:
#   ./report_battery.sh <DASHBOARD_URL> [DEVICE_ID] [--user-id <USER_ID>]
#   ./report_battery.sh --install <DASHBOARD_URL> [DEVICE_ID] [--user-id <USER_ID>]
#   ./report_battery.sh --uninstall
#
# Examples:
#   ./report_battery.sh http://localhost:8080
#   ./report_battery.sh http://localhost:8080 macbook-pro --user-id user_abc123
#   ./report_battery.sh --install http://localhost:8080 macbook
#   ./report_battery.sh --uninstall
# ==========================================================================

set -euo pipefail

PLIST_LABEL="com.statuser.battery"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
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
            echo "Statuser macOS Battery Reporter"
            echo ""
            echo "Usage:"
            echo "  ./report_battery.sh <URL> [DEVICE_ID] [--user-id <ID>]"
            echo "  ./report_battery.sh --install <URL> [DEVICE_ID] [--user-id <ID>]"
            echo "  ./report_battery.sh --uninstall"
            echo ""
            echo "Options:"
            echo "  --user-id <ID>   Associate reports with a specific user account"
            echo "  --install        Create a LaunchAgent to report every 5 minutes"
            echo "  --uninstall      Remove the LaunchAgent"
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
    echo "Removing Statuser LaunchAgent..."
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH"
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

# ── Install (LaunchAgent) ────────────────────────────────────────────────

if [[ "$ACTION" == "install" ]]; then
    DEVICE_ID="${DEVICE_ID:-$(hostname -s | tr '[:upper:]' '[:lower:]')}"

    # Build program arguments
    ARGS_XML="        <string>/bin/bash</string>
        <string>${SCRIPT_PATH}</string>
        <string>${DASHBOARD_URL}</string>
        <string>${DEVICE_ID}</string>"

    if [[ -n "$USER_ID" ]]; then
        ARGS_XML="$ARGS_XML
        <string>--user-id</string>
        <string>${USER_ID}</string>"
    fi

    mkdir -p "$(dirname "$PLIST_PATH")"
    cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
${ARGS_XML}
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/statuser_battery.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/statuser_battery.err</string>
</dict>
</plist>
PLIST

    # Load the agent
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load "$PLIST_PATH"

    echo "✓ Statuser LaunchAgent installed!"
    echo "  Reporting every 5 minutes to: $DASHBOARD_URL"
    echo "  Device ID: $DEVICE_ID"
    [[ -n "$USER_ID" ]] && echo "  User ID: $USER_ID"
    echo ""
    echo "  To uninstall: ./report_battery.sh --uninstall"
    exit 0
fi

# ── Report battery telemetry ─────────────────────────────────────────────

DEVICE_ID="${DEVICE_ID:-$(hostname -s | tr '[:upper:]' '[:lower:]')}"
DEVICE_NAME="$(scutil --get ComputerName 2>/dev/null || hostname -s)"
MODEL="$(sysctl -n hw.model 2>/dev/null || echo 'Mac')"

# Check if this Mac has a battery (desktops like iMac/Mac Pro/Mac Mini don't)
if ! pmset -g batt 2>/dev/null | grep -q "InternalBattery"; then
    # Desktop Mac — report as always plugged in
    PERCENTAGE=100
    IS_CHARGING="true"
    POWER_SOURCE="AC Power (Desktop)"
    HEALTH_STR="N/A (Desktop)"
    CYCLES=0
else
    # Read battery info from pmset
    BATT_INFO=$(pmset -g batt)
    PERCENTAGE=$(echo "$BATT_INFO" | grep -oE '[0-9]+%' | tr -d '%' | head -n 1)
    POWER_SOURCE=$(echo "$BATT_INFO" | grep "Now drawing from" | sed -E "s/.*'([^']+)'.*/\1/")

    # Detect charging status
    if echo "$BATT_INFO" | grep -q "charging;" && ! echo "$BATT_INFO" | grep -q "not charging"; then
        IS_CHARGING="true"
    else
        IS_CHARGING="false"
    fi

    # Health and cycles from system_profiler
    CYCLES=$(system_profiler SPPowerDataType 2>/dev/null | grep "Cycle Count" | awk '{print $3}' | head -n 1)
    HEALTH=$(system_profiler SPPowerDataType 2>/dev/null | grep "Maximum Capacity" | awk '{print $3}' | head -n 1)
    CONDITION=$(system_profiler SPPowerDataType 2>/dev/null | grep "Condition" | awk '{print $2}' | head -n 1)

    if [[ -n "$HEALTH" ]]; then
        HEALTH_STR="${HEALTH} (${CONDITION:-Normal})"
    else
        HEALTH_STR="${CONDITION:-Normal}"
    fi
fi

# System metrics (CPU & RAM)
CPU_USAGE=$(top -l 1 2>/dev/null | grep -E "^CPU usage" | awk '{print $3}' | tr -d '%' || echo "0")
TOTAL_MEM=$(sysctl -n hw.memsize 2>/dev/null || echo "17179869184")
PAGES_FREE=$(vm_stat 2>/dev/null | grep "Pages free" | awk '{print $3}' | tr -d '.' || echo "100000")
PAGES_ACTIVE=$(vm_stat 2>/dev/null | grep "Pages active" | awk '{print $3}' | tr -d '.' || echo "200000")
RAM_USAGE=$(echo "scale=1; ($PAGES_ACTIVE / ($PAGES_FREE + $PAGES_ACTIVE)) * 100" | bc 2>/dev/null || echo "50.0")

# Fallback values if empty
PERCENTAGE=${PERCENTAGE:-100}
CYCLES=${CYCLES:-0}
CPU_USAGE=${CPU_USAGE:-0}
RAM_USAGE=${RAM_USAGE:-0}

# Build JSON payload
JSON_PAYLOAD=$(cat <<EOF
{
  "device_id": "${DEVICE_ID}",
  "name": "${DEVICE_NAME}",
  "platform": "macos",
  "model": "${MODEL}",
  "battery_level": ${PERCENTAGE},
  "is_charging": ${IS_CHARGING},
  "power_source": "${POWER_SOURCE:-Battery}",
  "battery_health": "${HEALTH_STR}",
  "cycle_count": ${CYCLES},
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
