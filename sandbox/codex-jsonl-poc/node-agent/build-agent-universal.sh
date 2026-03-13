#!/usr/bin/env bash
set -euo pipefail

AGENT_DIR="/Users/eric/Documents/CodeAgent/sandbox/codex-jsonl-poc/node-agent"
ENTRY="index.js"
OUT_DIR="$AGENT_DIR/dist"

mkdir -p "$OUT_DIR"
cd "$AGENT_DIR"

if ! command -v pkg >/dev/null 2>&1; then
  echo "pkg not found. Installing globally..."
  npm i -g pkg
fi

echo "Building arm64..."
pkg "$ENTRY" --targets node18-macos-arm64 --output "$OUT_DIR/agent-macos-arm64"

echo "Building x64..."
pkg "$ENTRY" --targets node18-macos-x64 --output "$OUT_DIR/agent-macos-x64"

echo "Done:"
ls -lh "$OUT_DIR"/agent-macos-*
