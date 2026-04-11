#!/usr/bin/env python3
"""Git Hooks 安装脚本"""
import os
import sys
import subprocess
from pathlib import Path

HOOKS_DIR = Path(__file__).parent.resolve()
PROJECT_DIR = HOOKS_DIR.parent


def install():
    git_dir = PROJECT_DIR / ".git"
    if not git_dir.exists():
        print("❌ 不是 Git 仓库")
        return False
    
    # 设置 core.hooksPath
    result = subprocess.run(
        ["git", "config", "core.hooksPath", str(HOOKS_DIR)],
        cwd=PROJECT_DIR
    )
    
    if result.returncode == 0:
        print(f"✅ Git hooks 安装成功!")
        print(f"   hooks 目录: {HOOKS_DIR}")
        print(f"   当前配置: git config core.hooksPath = {HOOKS_DIR}")
        return True
    else:
        print("❌ 安装失败")
        return False


def uninstall():
    result = subprocess.run(
        ["git", "config", "--unset", "core.hooksPath"],
        cwd=PROJECT_DIR
    )
    
    if result.returncode == 0:
        print("✅ Git hooks 已移除")
        return True
    else:
        print("❌ 移除失败")
        return False


def status():
    result = subprocess.run(
        ["git", "config", "core.hooksPath"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    
    hooks_path = result.stdout.strip() if result.returncode == 0 else ""
    
    if hooks_path == str(HOOKS_DIR):
        print(f"✅ Git hooks 已安装: {hooks_path}")
    elif hooks_path:
        print(f"⚠️ 使用了其他 hooks 目录: {hooks_path}")
    else:
        print("❌ Git hooks 未安装（使用默认 .git/hooks）")
    
    print(f"\n可用 hooks: {list(HOOKS_DIR.glob('*'))}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "install"
    
    if cmd == "install":
        install()
    elif cmd == "uninstall":
        uninstall()
    elif cmd == "status":
        status()
    else:
        print(f"用法: python3 install.py [install|uninstall|status]")
