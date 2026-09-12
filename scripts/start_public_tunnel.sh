#!/bin/bash
# Multi-Device Dashboard - Cloudflare Public HTTPS Tunnel
# Gives you a free, public HTTPS URL so your iPhone, Android, and remote PCs
# can access the dashboard and report battery levels from anywhere over 5G/Wi-Fi.

CLOUDFLARED_BIN="$(which cloudflared 2>/dev/null || echo '/opt/homebrew/bin/cloudflared')"

if [ ! -x "$CLOUDFLARED_BIN" ]; then
    echo "Error: cloudflared not found. Install via: brew install cloudflared"
    exit 1
fi

LOG_FILE="/tmp/cloudflared_dashboard.log"
URL_FILE="$(dirname "$0")/../public/tunnel_url.json"

echo "Starting Cloudflare HTTPS tunnel for http://localhost:8080..."
"$CLOUDFLARED_BIN" tunnel --url http://localhost:8080 > "$LOG_FILE" 2>&1 &
TUNNEL_PID=$!

echo "Waiting for public HTTPS URL..."
for i in {1..20}; do
    TUNNEL_URL=$(grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" "$LOG_FILE" | head -n 1)
    if [ -n "$TUNNEL_URL" ]; then
        echo "=========================================================="
        echo "🎉 Public HTTPS URL Ready:"
        echo "👉 $TUNNEL_URL"
        echo "=========================================================="
        echo "{\"url\": \"$TUNNEL_URL\"}" > "$URL_FILE"
        echo "$TUNNEL_URL" > /tmp/dashboard_tunnel_url.txt
        echo "Saved to $URL_FILE"
        exit 0
    fi
    sleep 1
done

echo "Timed out waiting for tunnel URL. Check $LOG_FILE for details."
exit 1
