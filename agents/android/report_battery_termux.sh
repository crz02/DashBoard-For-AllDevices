#!/data/data/com.termux/files/usr/bin/bash
# Multi-Device Dashboard - Android Battery Reporter via Termux:API
# Prerequisites: Install Termux and Termux:API from F-Droid, then run: pkg install termux-api jq curl

DASHBOARD_URL="${1:-http://YOUR_SERVER_IP:8080}"
DEVICE_ID="${2:-android-phone}"
DEVICE_NAME="${3:-Android Device}"

# Query Termux API
BATT_JSON=$(termux-battery-status 2>/dev/null)

if [ -z "$BATT_JSON" ]; then
    echo "Error: termux-battery-status returned empty. Ensure Termux:API app is installed."
    exit 1
fi

PERCENTAGE=$(echo "$BATT_JSON" | jq -r '.percentage // 100')
STATUS=$(echo "$BATT_JSON" | jq -r '.status // "DISCHARGING"')
PLUGGED=$(echo "$BATT_JSON" | jq -r '.plugged // "UNPLUGGED"')
HEALTH=$(echo "$BATT_JSON" | jq -r '.health // "GOOD"')
TEMP=$(echo "$BATT_JSON" | jq -r '.temperature // 30.0')

if [ "$STATUS" = "CHARGING" ] || [ "$PLUGGED" != "UNPLUGGED" ]; then
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

echo "Reporting Android status to $DASHBOARD_URL..."
curl -s -X POST "$DASHBOARD_URL/api/report" \
     -H "Content-Type: application/json" \
     -d "$JSON_PAYLOAD"

echo ""
