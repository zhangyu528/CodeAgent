#!/bin/bash
# Auto-fix ESLint warnings that can be fixed automatically
# Usage: ./scripts/fix-lint.sh

set -e

cd "$(dirname "$0")/.."

echo "Running ESLint with auto-fix..."
bunx eslint src/ --fix --format stylish

echo "Re-running ESLint check..."
bunx eslint src/ --max-warnings=0
