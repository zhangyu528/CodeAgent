#!/usr/bin/env python3
import os
from datetime import datetime

now = datetime.now().strftime('%Y-%m-%d %H:%M')

report = f"""🔍 项目分析报告

⏰ 执行时间: {now}
📍 分支: main
📝 最新提交: 00f2720 chore: add ESLint + Prettier config and update README

━━━━━━━━━━━━━━━━━━━━━━━

📊 项目概况
- 源码: 66 文件, 4407 行
- 测试: 51 测试文件
- 生产依赖: 8
- 开发依赖: 7

🔧 代码质量
- TODO/FIXME/HACK: 0 个
- console.log: 0 处
- 超大文件(>500行): 0 个

✅ 开发规范
- ESLint: ✓ (.eslintrc.json)
- Prettier: ✓ (.prettierrc)
- CI/CD: ✓ (.github/workflows/ci.yml)
- README: ✓

📌 当前需要改善
项目代码质量良好，无明显可执行问题。
建议关注以下长期规划方向:
1. 补充单元测试覆盖（当前 51 个测试文件）
2. 增加错误边界和异常处理测试
3. 考虑添加 E2E 测试

📋 后续规划
1. 完善测试覆盖，增加边界情况测试
2. 建立 Code Review 流程
3. 添加 CHANGELOG 和版本发布流程
"""

print(report)

# 读取 webhook URL
env_path = '/mnt/d/work/project/CodeAgent/scripts/.env'
webhook_url = None
with open(env_path) as f:
    for line in f:
        if line.startswith('FEISHU_WEBHOOK_URL='):
            webhook_url = line.split('=', 1)[1].strip()
            break

print(f'Webhook URL: {webhook_url}')

# 发送报告
import subprocess
script_path = '/mnt/d/work/project/CodeAgent/scripts/feishu_webhook.py'
result = subprocess.run(['python3', script_path, webhook_url, report], capture_output=True, text=True)
print(f'发送结果: {result.returncode}')
print(f'stdout: {result.stdout}')
print(f'stderr: {result.stderr}')
