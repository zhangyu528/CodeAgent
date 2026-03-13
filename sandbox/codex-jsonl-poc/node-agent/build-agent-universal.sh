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

PKG_BIN="$(command -v pkg || true)"
if [[ -z "$PKG_BIN" ]]; then
  # Fallback: locate global npm bin via prefix
  NPM_PREFIX="$(npm config get prefix)"
  PKG_BIN="$NPM_PREFIX/bin/pkg"
fi

if [[ ! -x "$PKG_BIN" ]]; then
  echo "pkg still not found after install. Try: $(npm config get prefix)/bin/pkg"
  exit 1
fi

echo "Building arm64..."
"$PKG_BIN" "$ENTRY" --targets node18-macos-arm64 --output "$OUT_DIR/agent-macos-arm64"

echo "Building x64..."
"$PKG_BIN" "$ENTRY" --targets node18-macos-x64 --output "$OUT_DIR/agent-macos-x64"

echo "Done:"
ls -lh "$OUT_DIR"/agent-macos-*
