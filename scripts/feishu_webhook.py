#!/usr/bin/env python3
"""
飞书 Webhook 发送脚本
用于发送格式化消息到飞书群

使用方法:
  python scripts/feishu_webhook.py "你的webhook_url" "消息内容"
"""

import sys
import json
import requests


def send_card(webhook_url: str, card: dict) -> dict:
    """
    发送 Interactive Card 到飞书 webhook

    Args:
        webhook_url: 飞书机器人的 webhook URL
        card: 卡片元素列表

    Returns:
        API 响应字典
    """
    payload = {
        "msg_type": "interactive",
        "card": {
            "config": {"wide_screen_mode": True},
            "elements": card
        }
    }

    headers = {"Content-Type": "application/json"}

    response = requests.post(webhook_url, headers=headers, data=json.dumps(payload))
    return response.json()


def send_text_message(webhook_url: str, text: str) -> dict:
    """
    发送文本消息到飞书 webhook

    Args:
        webhook_url: 飞书机器人的 webhook URL
        text: 要发送的文本内容

    Returns:
        API 响应字典
    """
    payload = {
        "msg_type": "text",
        "content": {
            "text": text
        }
    }

    headers = {"Content-Type": "application/json"}

    response = requests.post(webhook_url, headers=headers, data=json.dumps(payload))
    return response.json()


def send_rich_text_message(webhook_url: str, title: str, content: str) -> dict:
    """
    发送富文本消息到飞书 webhook

    Args:
        webhook_url: 飞书机器人的 webhook URL
        title: 标题
        content: 内容 (支持换行)

    Returns:
        API 响应字典
    """
    payload = {
        "msg_type": "text",
        "content": {
            "text": f"📊 {title}\n\n{content}"
        }
    }

    headers = {"Content-Type": "application/json"}

    response = requests.post(webhook_url, headers=headers, data=json.dumps(payload))
    return response.json()


def send_markdown_message(webhook_url: str, content: str) -> dict:
    """
    发送 Markdown 格式消息到飞书 webhook

    注意: 飞书 webhook 仅支持部分 Markdown 语法
    支持: bold, link, at, br

    Args:
        webhook_url: 飞书机器人的 webhook URL
        content: Markdown 格式内容

    Returns:
        API 响应字典
    """
    payload = {
        "msg_type": "text",
        "content": {
            "text": content
        }
    }

    headers = {"Content-Type": "application/json"}

    response = requests.post(webhook_url, headers=headers, data=json.dumps(payload))
    return response.json()


# ─── Interactive Card 构建函数 ────────────────────────────────────────────────

def card_start(title: str, subtitle: str, from_name: str = "CodeAgent 自主优化") -> list:
    """
    启动卡片 — cron 触发后发送，表示开始分析

    Args:
        title: 卡片标题
        subtitle: 副标题/状态描述
        from_name: 来源名称

    Returns:
        卡片 elements 列表
    """
    from datetime import datetime
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return [
        {
            "tag": "markdown",
            "content": f"**🚀 {title}**\n---\n⏰ **开始时间** | {now}\n📍 **目标** | CodeAgent 项目\n---\n🔍 *{subtitle}*"
        }
    ]


def card_analysis_report(
    title: str,
    report_content: str,
    branch: str = "main",
    commit: str = ""
) -> list:
    """
    分析报告卡片 — project-analysis 完成后发送

    Args:
        title: 卡片标题
        report_content: 分析报告正文（markdown 格式）
        branch: 当前分支名
        commit: 最新 commit hash + message

    Returns:
        卡片 elements 列表
    """
    return [
        {
            "tag": "markdown",
            "content": f"**📊 {title}**\n---\n📍 **分支** | `{branch}`\n📝 **最新提交** | `{commit}`\n---\n{report_content}"
        }
    ]


def card_execution_start(task_count: int, from_name: str = "CodeAgent 自主优化") -> list:
    """
    执行启动卡片 — task-executor 开始执行前发送

    Args:
        task_count: 待执行任务数量
        from_name: 来源名称

    Returns:
        卡片 elements 列表
    """
    from datetime import datetime
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    task_text = f"共 **{task_count}** 个任务" if task_count > 0 else "无待执行任务"

    return [
        {
            "tag": "markdown",
            "content": f"**🔧 开始执行任务**\n---\n⏰ **开始时间** | {now}\n📋 **{task_text}**\n---\n正在执行中，请稍候..."
        }
    ]


def card_execution_report(
    title: str,
    total: int,
    success: int,
    failed: int,
    skipped: int,
    details: str = ""
) -> list:
    """
    执行报告卡片 — task-executor 执行完成后发送（不含 commit 信息）

    注意: commit 信息由 post-commit hook 单独发送，这里只报告任务执行结果

    Args:
        title: 卡片标题
        total: 总任务数
        success: 成功数
        failed: 失败数
        skipped: 跳过数
        details: 任务详情（markdown 格式）

    Returns:
        卡片 elements 列表
    """
    from datetime import datetime
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 状态汇总
    if failed > 0:
        status_emoji = "⚠️"
        status_text = "部分失败"
    elif success == total:
        status_emoji = "✅"
        status_text = "全部完成"
    elif skipped == total:
        status_emoji = "⏭️"
        status_text = "全部跳过"
    else:
        status_emoji = "⚡"
        status_text = "执行完成"

    summary_md = f"**{status_emoji} {title}**\n"
    summary_md += f"---\n"
    summary_md += f"📋 **状态** | {status_text}\n"
    summary_md += f"✅ **成功** | {success} 个\n"
    summary_md += f"❌ **失败** | {failed} 个\n"
    summary_md += f"⏭️ **跳过** | {skipped} 个\n"
    summary_md += f"⏰ **完成时间** | {now}\n"

    elements = [{"tag": "markdown", "content": summary_md}]

    if details:
        elements.append({"tag": "markdown", "content": f"---\n{details}"})

    return elements


def card_error(title: str, error_msg: str) -> list:
    """
    错误卡片 — 执行过程中出错时发送

    Args:
        title: 错误标题
        error_msg: 错误信息

    Returns:
        卡片 elements 列表
    """
    from datetime import datetime
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return [
        {
            "tag": "markdown",
            "content": f"**🚨 {title}**\n---\n⏰ **时间** | {now}\n---\n```\n{error_msg}\n```"
        }
    ]


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("使用方法: python scripts/feishu_webhook.py <webhook_url> <消息内容>")
        print("示例: python scripts/feishu_webhook.py https://open.feishu.cn/xxx '测试消息'")
        sys.exit(1)

    webhook_url = sys.argv[1]
    message = sys.argv[2]

    result = send_text_message(webhook_url, message)
    print(f"发送结果: {result}")
