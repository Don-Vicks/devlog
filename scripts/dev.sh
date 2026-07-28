#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  for pid in "$VITE_PID" "$TSC_PID"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

echo "▸ Starting core (tsc --watch)..."
npm run watch -w @devlog/core &
TSC_PID=$!

echo "▸ Building dashboard (initial)..."
npm run build -w @devlog/dashboard --silent

echo "▸ Starting Vite dev server on :5173..."
npm run dev -w @devlog/dashboard --silent &
VITE_PID=$!

echo "▸ Waiting for Vite..."
while ! lsof -i :5173 -P 2>/dev/null | grep -q LISTEN; do
  sleep 0.3
done

echo "▸ Building electron..."
npm run build -w @devlog/electron

# Must rebuild better-sqlite3 for Electron's Node version (MODULE_VERSION 128)
# vs system Node (MODULE_VERSION 137). The native binary only works with one.
echo "▸ Rebuilding better-sqlite3 for Electron 32.3.3..."
cd "$ROOT/node_modules/better-sqlite3" && rm -rf build && npx node-gyp rebuild --release --target=32.3.3 --arch=arm64 --dist-url=https://electronjs.org/headers 2>&1 | tail -1

echo "▸ Launching Electron..."
exec npx --yes electron "$ROOT/packages/electron"
