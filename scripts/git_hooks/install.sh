#!/bin/bash
# CodeAgent 安装脚本

echo "🔧 正在安装 CodeAgent..."

# 安装 Git hooks 配置
echo "📦 配置 Git hooks..."
git config core.hooksPath "$(dirname "$0")"
echo "✅ Git hooks 路径已配置: scripts/git_hooks"

# 确保 hooks 有执行权限
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$SCRIPT_DIR"/post-commit
echo "✅ Hooks 执行权限已设置"

# 安装依赖
echo "📦 安装依赖..."
bun install

echo ""
echo "✅ 安装完成！"
echo ""
echo "📝 后续步骤："
echo "1. 复制配置: cp .env.example .env"
echo "2. 配置飞书 Webhook: 在 scripts/.env 中设置 FEISHU_WEBHOOK_URL"
echo ""
