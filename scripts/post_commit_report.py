#!/usr/bin/env python3
"""
Git Post-Commit 报告脚本
每次提交后自动发送报告到飞书
"""

import subprocess
import os
import requests
from pathlib import Path


PROJECT_DIR = Path(__file__).parent.parent


def get_env(key: str) -> str:
    """从 .env 文件读取环境变量"""
    env_file = PROJECT_DIR / "scripts" / ".env"
    if env_file.exists():
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip() == key:
                        return v.strip().strip('"').strip("'")
    return os.getenv(key, "")


def get_git_info():
    """获取 Git 提交信息"""
    info = {}
    
    # 分支名
    result = subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True)
    info["branch"] = result.stdout.strip() if result.returncode == 0 else "unknown"
    
    # 最后一次提交
    result = subprocess.run(
        ["git", "log", "-1", "--format=%h|%s|%an|%ae|%ct"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        parts = result.stdout.strip().split("|")
        if len(parts) >= 5:
            info["hash"] = parts[0]
            info["subject"] = parts[1]
            info["author"] = parts[2]
            info["email"] = parts[3]
            info["timestamp"] = parts[4]
    
    # 提交统计
    result = subprocess.run(["git", "diff", "--stat", "HEAD~1..HEAD"], capture_output=True, text=True)
    info["diff_stat"] = result.stdout.strip() if result.returncode == 0 else ""
    
    # 改动文件列表
    result = subprocess.run(["git", "diff", "--name-only", "HEAD~1..HEAD"], capture_output=True, text=True)
    info["changed_files"] = [f for f in result.stdout.strip().split("\n") if f]
    
    return info


def generate_report(git_info: dict) -> str:
    """生成提交报告"""
    import datetime
    
    timestamp = datetime.datetime.fromtimestamp(int(git_info.get("timestamp", 0)))
    time_str = timestamp.strftime("%Y-%m-%d %H:%M")
    
    files = git_info.get("changed_files", [])
    file_count = len(files)
    
    report = f"""📝 Git 提交报告

⏰ {time_str}
🌿 分支: {git_info.get("branch", "unknown")}
📌 提交: {git_info.get("hash", "?")}

━━━━━━━━━━━━━━━━━━━━━━━

💬 {git_info.get("subject", "无描述")}

👤 {git_info.get("author", "unknown")}
📁 {file_count} 文件改动

"""
    
    if files:
        report += "📂 改动文件：\n"
        for f in files[:10]:  # 最多显示10个
            report += f"• {f}\n"
        if len(files) > 10:
            report += f"... 还有 {len(files) - 10} 个文件\n"
    
    if git_info.get("diff_stat"):
        report += f"""
📊 改动统计：
{git_info['diff_stat']}
"""
    
    report += "━━━━━━━━━━━━━━━━━━━━━━━"
    
    return report


def send_to_feishu(webhook_url: str, message: str):
    """发送到飞书"""
    payload = {"msg_type": "text", "content": {"text": message}}
    response = requests.post(webhook_url, json=payload)
    return response.json()


def main():
    webhook_url = get_env("FEISHU_WEBHOOK_URL")
    
    if not webhook_url:
        print("❌ 未设置 FEISHU_WEBHOOK_URL")
        exit(1)
    
    git_info = get_git_info()
    report = generate_report(git_info)
    
    print(report)
    
    result = send_to_feishu(webhook_url, report)
    if result.get("code") == 0:
        print("✅ 已发送到飞书")
    else:
        print(f"❌ 发送失败: {result}")


if __name__ == "__main__":
    main()
