import sys, subprocess
sys.path.insert(0, '/mnt/d/work/project/CodeAgent/scripts')
from feishu_webhook import send_card, card_start, card_task_preview, make_header, IDEAS_EXEC_HEADER

webhook = subprocess.check_output(
    "grep FEISHU_WEBHOOK_URL /mnt/d/work/project/CodeAgent/scripts/.env | cut -d'=' -f2",
    shell=True
).decode().strip()

# 卡片1：开始实现通知
header1 = make_header("💡 CodeAgent 提案执行 - 🚀 开始实现：Context Budget Manager", "orange")
card1 = card_start()
result1 = send_card(webhook, card1, header1)
print("Card 1 result:", result1)

# 卡片2：任务预览
tasks_text = """**Task 1**: 实现 contextBudget.ts 核心计算逻辑
**Task 2**: 实现 budgetStore（Zustand 状态管理）
**Task 3**: 集成 BudgetStore 到 chatStore
**Task 4**: 实现 BudgetBar UI 组件
**Task 5**: 集成 BudgetBar 到 ChatPage
**Task 6**: 实现 BudgetExceededModal（95% 硬截断拦截）"""

header2 = make_header("💡 CodeAgent 提案执行 - 📋 任务预览：Context Budget Manager", "orange")
card2 = card_task_preview(tasks=tasks_text, total=6)
result2 = send_card(webhook, card2, header2)
print("Card 2 result:", result2)
