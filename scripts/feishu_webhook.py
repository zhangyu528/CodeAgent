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
    
    headers = {
        "Content-Type": "application/json"
    }
    
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
    
    headers = {
        "Content-Type": "application/json"
    }
    
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
    
    headers = {
        "Content-Type": "application/json"
    }
    
    response = requests.post(webhook_url, headers=headers, data=json.dumps(payload))
    return response.json()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("使用方法: python scripts/feishu_webhook.py <webhook_url> <消息内容>")
        print("示例: python scripts/feishu_webhook.py https://open.feishu.cn/xxx '测试消息'")
        sys.exit(1)
    
    webhook_url = sys.argv[1]
    message = sys.argv[2]
    
    result = send_text_message(webhook_url, message)
    print(f"发送结果: {result}")
