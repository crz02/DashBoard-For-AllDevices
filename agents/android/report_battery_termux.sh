#!/data/data/com.termux/files/usr/bin/bash
# ==========================================================================
# Statuser — Android Battery Reporter via Termux:API
# Reports battery, temperature, and health to your Statuser dashboard.
#
# Prerequisites:
#   Install Termux and Termux:API from F-Droid, then run:
#   pkg update && pkg install termux-api jq curl
#
# Usage:
#   ./report_battery.sh <DASHBOARD_URL> [DEVICE_ID] [DEVICE_NAME] [--user-id <USER_ID>]
#   ./report_battery.sh --install <DASHBOARD_URL> [DEVICE_ID] [DEVICE_NAME]
#   ./report_battery.sh --uninstall
#
# Examples:
#   ./report_battery.sh http://YOUR_SERVER:8080 my-android "Samsung Galaxy"
#   ./report_battery.sh --install http://YOUR_SERVER:8080 pixel-7 "Pixel 7 Pro"
# ==========================================================================

set -euo pipefail

SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
CRON_TAG="# statuser-battery"

# ── Parse arguments ──────────────────────────────────────────────────────

ACTION="report"
DASHBOARD_URL=""
DEVICE_ID=""
DEVICE_NAME=""
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
            echo "Statuser Android Battery Reporter (Termux)"
            echo ""
            echo "Usage:"
            echo "  ./report_battery.sh <URL> [DEVICE_ID] [DEVICE_NAME] [--user-id <ID>]"
            echo "  ./report_battery.sh --install <URL> [DEVICE_ID] [DEVICE_NAME]"
            echo "  ./report_battery.sh --uninstall"
            exit 0
            ;;
        *)
            if [[ -z "$DASHBOARD_URL" ]]; then
                DASHBOARD_URL="$1"
            elif [[ -z "$DEVICE_ID" ]]; then
                DEVICE_ID="$1"
            elif [[ -z "$DEVICE_NAME" ]]; then
                DEVICE_NAME="$1"
            fi
            shift
            ;;
    esac
done

# ── Uninstall ────────────────────────────────────────────────────────────

if [[ "$ACTION" == "uninstall" ]]; then
    echo "Removing Statuser cron job..."
    crontab -l 2>/dev/null | grep -v "$CRON_TAG" | crontab - 2>/dev/null || true
    echo "✓ Uninstalled. Battery reporting stopped."
    exit 0
fi

# ── Validate URL ─────────────────────────────────────────────────────────

if [[ -z "$DASHBOARD_URL" ]]; then
    echo "Error: Dashboard URL is required."
    echo "Usage: ./report_battery.sh <DASHBOARD_URL> [DEVICE_ID] [DEVICE_NAME]"
    exit 1
fi

DASHBOARD_URL="${DASHBOARD_URL%/}"
DEVICE_ID="${DEVICE_ID:-android-phone}"
DEVICE_NAME="${DEVICE_NAME:-Android Device}"

# ── Install (cron job) ───────────────────────────────────────────────────

if [[ "$ACTION" == "install" ]]; then
    # Ensure cronie is available
    if ! command -v crontab &>/dev/null; then
        echo "Installing cronie..."
        pkg install -y cronie 2>/dev/null || {
            echo "Error: Could not install cronie. Run: pkg install cronie"
            exit 1
        }
    fi

    # Build the cron command
    CRON_CMD="$SCRIPT_PATH $DASHBOARD_URL $DEVICE_ID \"$DEVICE_NAME\""
    if [[ -n "$USER_ID" ]]; then
        CRON_CMD="$CRON_CMD --user-id $USER_ID"
    fi

    # Remove existing statuser cron entries, then add new one
    (crontab -l 2>/dev/null | grep -v "$CRON_TAG"; echo "*/5 * * * * $CRON_CMD >/dev/null 2>&1 $CRON_TAG") | crontab -

    echo "✓ Statuser cron job installed!"
    echo "  Reporting every 5 minutes to: $DASHBOARD_URL"
    echo "  Device: $DEVICE_NAME ($DEVICE_ID)"
    [[ -n "$USER_ID" ]] && echo "  User ID: $USER_ID"
    echo ""
    echo "  To uninstall: ./report_battery.sh --uninstall"
    exit 0
fi

# ── Report battery telemetry ─────────────────────────────────────────────

# Query Termux API
BATT_JSON=$(termux-battery-status 2>/dev/null || echo "")

if [[ -z "$BATT_JSON" ]]; then
    echo "Error: termux-battery-status returned empty."
    echo "Make sure Termux:API app is installed from F-Droid."
    exit 1
fi

PERCENTAGE=$(echo "$BATT_JSON" | jq -r '.percentage // 100')
STATUS=$(echo "$BATT_JSON" | jq -r '.status // "DISCHARGING"')
PLUGGED=$(echo "$BATT_JSON" | jq -r '.plugged // "UNPLUGGED"')
HEALTH=$(echo "$BATT_JSON" | jq -r '.health // "GOOD"')
TEMP=$(echo "$BATT_JSON" | jq -r '.temperature // 30.0')

if [[ "$STATUS" == "CHARGING" ]] || [[ "$PLUGGED" != "UNPLUGGED" ]]; then
    IS_CHARGING="true"
    POWER_SOURCE="AC Power"
else
    IS_CHARGING="false"
    POWER_SOURCE="Battery"
fi

JSON_PAYLOAD=$(cat <<EOF
{
  "device_id": "${DEVICE_ID}",
  "name": "${DEVICE_NAME}",
  "platform": "android",
  "battery_level": ${PERCENTAGE},
  "is_charging": ${IS_CHARGING},
  "power_source": "${POWER_SOURCE}",
  "battery_health": "${HEALTH}",
  "temperature": ${TEMP}
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
echo "✓ Reported: ${DEVICE_NAME} — ${PERCENTAGE}%"
