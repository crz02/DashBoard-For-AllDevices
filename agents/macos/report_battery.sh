#!/bin/bash
# Multi-Device Dashboard - macOS Battery Reporter
# Usage: ./report_battery.sh [DASHBOARD_URL] [DEVICE_ID]

DASHBOARD_URL="${1:-http://localhost:8080}"
DEVICE_ID="${2:-$(hostname -s | tr '[:upper:]' '[:lower:]')}"
DEVICE_NAME="$(scutil --get ComputerName 2>/dev/null || hostname -s)"
MODEL="$(sysctl -n hw.model 2>/dev/null || echo 'MacBook')"

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

# Optional detailed health and cycles from system_profiler
CYCLES=$(system_profiler SPPowerDataType 2>/dev/null | grep "Cycle Count" | awk '{print $3}' | head -n 1)
HEALTH=$(system_profiler SPPowerDataType 2>/dev/null | grep "Maximum Capacity" | awk '{print $3}' | head -n 1)
CONDITION=$(system_profiler SPPowerDataType 2>/dev/null | grep "Condition" | awk '{print $2}' | head -n 1)

if [ -n "$HEALTH" ]; then
    HEALTH_STR="${HEALTH} (${CONDITION:-Normal})"
else
    HEALTH_STR="${CONDITION:-Normal}"
fi

# System metrics (CPU & RAM)
CPU_USAGE=$(top -l 1 | grep -E "^CPU usage" | awk '{print $3}' | tr -d '%' 2>/dev/null || echo "0")
TOTAL_MEM=$(sysctl -n hw.memsize 2>/dev/null || echo "17179869184")
# Estimate RAM load via vm_stat if available
PAGES_FREE=$(vm_stat | grep "Pages free" | awk '{print $3}' | tr -d '.' 2>/dev/null || echo "100000")
PAGES_ACTIVE=$(vm_stat | grep "Pages active" | awk '{print $3}' | tr -d '.' 2>/dev/null || echo "200000")
RAM_USAGE=$(echo "scale=1; ($PAGES_ACTIVE / ($PAGES_FREE + $PAGES_ACTIVE)) * 100" | bc 2>/dev/null || echo "50.0")

# Fallback values if empty
PERCENTAGE=${PERCENTAGE:-100}
CYCLES=${CYCLES:-0}
CPU_USAGE=${CPU_USAGE:-0}
RAM_USAGE=${RAM_USAGE:-0}

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

echo "Sending telemetry to $DASHBOARD_URL/api/report..."
echo "$JSON_PAYLOAD"

curl -s -X POST "$DASHBOARD_URL/api/report" \
     -H "Content-Type: application/json" \
     -d "$JSON_PAYLOAD"

echo ""
