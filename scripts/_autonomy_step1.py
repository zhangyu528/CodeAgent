#!/usr/bin/env python3
import sys
sys.path.insert(0, '/mnt/d/work/project/CodeAgent/scripts')
from feishu_webhook import send_card, card_start

card = card_start(
    title="CodeAgent 自主优化",
    subtitle="开始分析"
)
import subprocess
webhook = subprocess.check_output(
    "grep FEISHU_WEBHOOK_URL /mnt/d/work/project/CodeAgent/scripts/.env | cut -d'=' -f2",
    shell=True
).decode().strip()
result = send_card(webhook, card)
print(result)
