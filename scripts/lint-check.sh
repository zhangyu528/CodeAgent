#!/bin/bash
# Lint check script - runs ESLint and exits non-zero on errors
set -e

cd "$(dirname "$0")/.."

echo "Running ESLint check..."
bun run lint

exit $?
