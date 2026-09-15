#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=============================================="
echo "      🚀 Starting Statuser Dashboard Server    "
echo "=============================================="

PORT="${PORT:-8080}"
echo "Server listening on http://localhost:$PORT"
echo "Press Ctrl+C to stop."
echo ""

exec python3 server/app.py
