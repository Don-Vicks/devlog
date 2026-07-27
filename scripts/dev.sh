#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  if [ -n "$VITE_PID" ]; then
    kill "$VITE_PID" 2>/dev/null || true
    wait "$VITE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "▸ Building core..."
npm run build -w @devlog/core --silent

echo "▸ Building dashboard..."
npm run build -w @devlog/dashboard --silent

echo "▸ Starting Vite dev server on :5173..."
npm run dev -w @devlog/dashboard --silent &
VITE_PID=$!

echo "▸ Waiting for Vite to be ready..."
for i in $(seq 1 30); do
  if curl -s http://localhost:5173 >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "✗ Vite failed to start after 30s"
    exit 1
  fi
  sleep 1
done
echo "  Vite ready (pid $VITE_PID)"

echo "▸ Building electron..."
npm run build -w @devlog/electron

echo "▸ Launching Electron..."
exec npx --yes electron "$ROOT/packages/electron"
