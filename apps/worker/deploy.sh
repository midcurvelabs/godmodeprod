#!/bin/bash
set -e

echo "=== GodModeProd Worker Deploy ==="
echo "Pulling latest from main..."
git pull origin main

# Use whichever Compose is installed. openclaw runs the legacy `docker-compose`
# (v1-style binary); newer hosts use the `docker compose` plugin.
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Error: neither 'docker compose' nor 'docker-compose' is available." >&2
  exit 1
fi

# deploy.sh lives in apps/worker/ but compose file is at the repo root.
cd "$(dirname "$0")/../.."

echo "Building and starting services with: $COMPOSE"
$COMPOSE up -d --build worker

echo ""
echo "Deploy complete. Tailing logs (Ctrl+C to stop)..."
$COMPOSE logs -f worker --tail=30
