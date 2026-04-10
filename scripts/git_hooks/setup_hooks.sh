#!/bin/bash
# 安装 Git hooks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
HOOKS_DIR="$PROJECT_DIR/.git/hooks"

echo "🔧 安装 Git hooks..."

# 复制 post-commit hook
cp "$SCRIPT_DIR/post-commit" "$HOOKS_DIR/post-commit"
chmod +x "$HOOKS_DIR/post-commit"

echo "✅ Git hooks 安装完成!"
echo "   post-commit hook 已安装"
echo ""
echo "💡 每次 git commit 完成后会自动发送测试报告到飞书"
