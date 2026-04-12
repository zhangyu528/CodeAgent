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
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


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

    response = requests.post(webhook_url, headers=headers, data=json.dumps(payload), timeout=10)
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

    response = requests.post(webhook_url, headers=headers, data=json.dumps(payload), timeout=10)
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

    response = requests.post(webhook_url, headers=headers, data=json.dumps(payload), timeout=10)
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

    response = requests.post(webhook_url, headers=headers, data=json.dumps(payload), timeout=10)
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


def card_feature_report(
    title: str,
    feature_content: str,
    branch: str = "main",
    problem_statement: str = "",
    mvp_scope: str = "",
    not_doing: str = "",
    open_questions: str = ""
) -> list:
    """
    新功能报告卡片 — idea-refine 完成后发送

    Args:
        title: 卡片标题
        feature_content: 新功能完整报告（markdown 格式）
        branch: 当前分支名
        problem_statement: 问题陈述
        mvp_scope: MVP 范围
        not_doing: 不做什么
        open_questions: 开放问题

    Returns:
        卡片 elements 列表
    """
    return [
        {
            "tag": "markdown",
            "content": f"**💡 {title}**\n---\n📍 **分支** | `{branch}`\n---\n{feature_content}"
        }
    ]


def card_task_preview(
    title: str,
    tasks: str,
    total: int = 0,
    from_name: str = "CodeAgent 自主优化"
) -> list:
    """
    执行前任务预览卡片 — 列出即将执行的任务列表

    Args:
        title: 卡片标题
        tasks: 任务列表（markdown 格式，每行一个任务）
        total: 任务总数
        from_name: 来源名称

    Returns:
        卡片 elements 列表
    """
    from datetime import datetime
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    task_count_text = f"**{total}** 个任务" if total > 0 else "无任务"

    header = f"**📋 {title}**\n---\n⏰ **预览时间** | {now}\n📋 **任务数量** | {task_count_text}\n---\n**待执行任务：**\n{tasks}\n\n---\n⏳ 确认后开始执行..."
    return [{"tag": "markdown", "content": header}]


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


def card_commit_report(
    commit_hash: str,
    branch: str,
    commit_time: str,
    author: str,
    commit_msg: str = "",
    files_changed: int = 0,
    insertions: int = 0,
    deletions: int = 0,
    new_files: int = 0,
    modified_files: int = 0,
    deleted_files: int = 0,
    src_changes: int = 0,
    test_changes: int = 0,
    script_changes: int = 0,
    files: str = "",
    agent: str = "",
    model: str = ""
) -> list:
    """
    Commit 报告卡片 — post-commit hook 使用，发送 commit 变更信息

    Args:
        commit_hash: commit hash (短)
        branch: 分支名
        commit_time: 提交时间
        author: 提交作者
        commit_msg: commit 消息
        files_changed: 变更文件总数
        insertions: 新增行数
        deletions: 删除行数
        new_files: 新增文件数
        modified_files: 修改文件数
        deleted_files: 删除文件数
        src_changes: src/ 目录变更数
        test_changes: tests/ 目录变更数
        script_changes: scripts/ 目录变更数
        files: 变更文件列表
        agent: Agent 名称（autonomy job 才传入）
        model: LLM 模型名称（autonomy job 才传入）

    Returns:
        卡片 elements 列表
    """
    # Agent + Model 行（仅当 agent 非空时显示）
    agent_model_line = ""
    if agent:
        model_part = f" | 🧠 **{model}**" if model else ""
        agent_model_line = f"\n👤 **Agent** | {agent}{model_part}\n---"

    return [
        {
            "tag": "markdown",
            "content": f"""**📝 Commit 报告**
---
🔖 **Commit** | `{commit_hash}`
📋 **分支** | `{branch}`
👤 **作者** | {author}
⏰ **时间** | {commit_time}
---{agent_model_line}
📊 **变更统计**
• 文件数: {files_changed} 个
• 新增: {new_files} 个 | 修改: {modified_files} 个 | 删除: {deleted_files} 个
• +{insertions} / -{deletions} 行
---
📁 **变更分类**
• 源代码 (src/): {src_changes} 个
• 测试文件 (tests/): {test_changes} 个
• 脚本 (scripts/): {script_changes} 个
---
📝 **Commit 消息**
{commit_msg}
---
变更文件:
{files}"""
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
