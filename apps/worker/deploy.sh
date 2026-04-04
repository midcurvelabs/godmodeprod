#!/bin/bash
set -e

echo "=== GodModeProd Worker Deploy ==="
echo "Pulling latest from main..."
git pull origin main

echo "Building and starting services..."
docker compose up -d --build worker

echo ""
echo "Deploy complete. Tailing logs (Ctrl+C to stop)..."
docker compose logs -f worker --tail=30
