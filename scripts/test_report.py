#!/usr/bin/env python3
"""
测试状况报告生成脚本
用于每小时向飞书群发送测试状况报告
"""

import subprocess
import json
import os
import requests
from datetime import datetime
from pathlib import Path


# 尝试从 scripts/.env 读取环境变量
SCRIPT_DIR = Path(__file__).parent.absolute()
ENV_FILE = SCRIPT_DIR / ".env"

def load_env_file():
    """从 scripts/.env 加载环境变量"""
    if ENV_FILE.exists():
        with open(ENV_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ[key.strip()] = value.strip().strip('"').strip("'")


load_env_file()


def get_vitest_summary():
    """获取 vitest 测试摘要"""
    try:
        result = subprocess.run(
            ["npx", "vitest", "run", "--reporter=json", "--outputJson=test-results.json"],
            capture_output=True,
            text=True,
            timeout=180
        )
        
        try:
            with open("test-results.json", "r") as f:
                data = json.load(f)
            return data
        except:
            pass
        
        return {
            "exit_code": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr
        }
    except Exception as e:
        return {"error": str(e)}


def get_test_file_stats():
    """获取测试文件统计"""
    stats = {
        "total_files": 0,
        "unit_tests": 0,
        "integration_tests": 0,
        "e2e_tests": 0,
        "files": []
    }
    
    try:
        result = subprocess.run(
            ["find", "tests", "-name", "*.test.*", "-o", "-name", "*.spec.*"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            files = [f for f in result.stdout.strip().split("\n") if f]
            stats["total_files"] = len(files)
            
            for f in files:
                if "unit" in f.lower():
                    stats["unit_tests"] += 1
                elif "integration" in f.lower():
                    stats["integration_tests"] += 1
                elif "e2e" in f.lower() or "endtoend" in f.lower():
                    stats["e2e_tests"] += 1
                else:
                    stats["unit_tests"] += 1
                stats["files"].append(f)
    except Exception as e:
        stats["error"] = str(e)
    
    return stats


def analyze_test_coverage():
    """分析测试覆盖策略"""
    test_stats = get_test_file_stats()
    
    analysis = {
        "test_strategies": [],
        "has_mock_only_tests": False,
        "has_real_component_tests": False,
        "has_e2e_tests": False,
        "coverage_quality": "unknown"
    }
    
    if test_stats["total_files"] > 0:
        analysis["test_strategies"].append("单元测试 (Unit Tests)")
    
    if test_stats["integration_tests"] > 0:
        analysis["test_strategies"].append("集成测试 (Integration Tests)")
    
    if test_stats["e2e_tests"] > 0:
        analysis["test_strategies"].append("端到端测试 (E2E Tests)")
    
    for f in test_stats.get("files", []):
        try:
            with open(f, "r") as file:
                content = file.read()
                if "mock" in content.lower() and "render" not in content.lower():
                    analysis["has_mock_only_tests"] = True
                if "render" in content.lower() or "screen." in content.lower():
                    analysis["has_real_component_tests"] = True
                if "playwright" in content.lower() or "cypress" in content.lower():
                    analysis["has_e2e_tests"] = True
        except:
            pass
    
    if analysis["has_real_component_tests"] and analysis["has_e2e_tests"]:
        analysis["coverage_quality"] = "优秀 - 包含真实组件测试和 E2E 测试"
    elif analysis["has_real_component_tests"]:
        analysis["coverage_quality"] = "良好 - 包含真实组件测试"
    elif analysis["has_mock_only_tests"]:
        analysis["coverage_quality"] = "需改进 - 仅有 mock 逻辑测试"
    else:
        analysis["coverage_quality"] = "一般 - 需要更多测试"
    
    return analysis


def get_project_status():
    """获取项目状态信息"""
    status = {
        "name": "CodeAgent",
        "description": "基于 AI 的 CLI 编程助手",
        "branch": "unknown",
        "tech_stack": [],
        "current_features": []
    }
    
    try:
        with open("/mnt/d/work/project/CodeAgent/package.json", "r") as f:
            pkg = json.load(f)
            status["name"] = pkg.get("name", "CodeAgent")
            status["description"] = pkg.get("description", "")
    except:
        pass
    
    try:
        result = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True,
            text=True,
            cwd="/mnt/d/work/project/CodeAgent"
        )
        if result.returncode == 0:
            status["branch"] = result.stdout.strip()
    except:
        pass
    
    status["tech_stack"] = [
        "TypeScript",
        "React/Ink (TUI)",
        "Zustand (状态管理)",
        "Vitest (测试)",
        "Bun (运行时)"
    ]
    
    status["current_features"] = [
        "AI 对话界面 (TUI)",
        "多 Provider 支持 (OpenAI/Anthropic/Zhipu/Minimax)",
        "会话持久化 (SQLite)",
        "Slash 命令系统 (/help, /model, /new)",
        "文件操作工具",
        "Web 搜索工具"
    ]
    
    return status


def generate_report():
    """生成测试报告"""
    print("📊 正在生成测试报告...")
    
    stats = get_test_file_stats()
    analysis = analyze_test_coverage()
    project_status = get_project_status()
    
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    report = f"""📊 测试状况报告

⏰ 生成时间: {now}

━━━━━━━━━━━━━━━━━━━━━━━

🏠 项目: {project_status['name']}
📝 描述: {project_status['description']}
🔀 分支: {project_status.get('branch', 'unknown')}

🛠️ 技术栈:
"""
    
    for tech in project_status["tech_stack"]:
        report += f"• {tech}\n"
    
    report += """
✨ 当前功能:
"""
    for feature in project_status["current_features"]:
        report += f"• {feature}\n"
    
    report += """
━━━━━━━━━━━━━━━━━━━━━━━

📁 测试文件统计:
• 总测试文件: {} 个
• 单元测试: {} 个
• 集成测试: {} 个
• E2E 测试: {} 个

🧪 测试策略分析:
""".format(
        stats.get('total_files', 0),
        stats.get('unit_tests', 0),
        stats.get('integration_tests', 0),
        stats.get('e2e_tests', 0)
    )
    
    if analysis["test_strategies"]:
        for strategy in analysis["test_strategies"]:
            report += f"• ✅ {strategy}\n"
    else:
        report += "• ❌ 暂无测试\n"
    
    report += f"""
📈 覆盖质量: {analysis['coverage_quality']}

🔍 详细分析:
"""
    
    if analysis.get("has_mock_only_tests"):
        report += "• ⚠️ 发现部分测试仅使用 mock，不涉及真实组件渲染\n"
    if analysis.get("has_real_component_tests"):
        report += "• ✅ 包含真实组件渲染测试\n"
    if analysis.get("has_e2e_tests"):
        report += "• ✅ 包含端到端测试\n"
    
    report += """
━━━━━━━━━━━━━━━━━━━━━━━

💡 建议:
"""
    
    if not analysis.get("has_real_component_tests"):
        report += "1. 添加真实组件渲染测试（如使用 React Testing Library）\n"
    if not analysis.get("has_e2e_tests"):
        report += "2. 考虑添加 E2E 测试（如 Playwright/Cypress）\n"
    if analysis.get("has_mock_only_tests"):
        report += "3. 将部分 mock 测试改为真实组件测试\n"
    
    report += """
━━━━━━━━━━━━━━━━━━━━━━━
报告完毕
"""
    
    return report


def send_to_feishu(webhook_url: str, message: str):
    """发送消息到飞书"""
    payload = {
        "msg_type": "text",
        "content": {
            "text": message
        }
    }
    
    response = requests.post(webhook_url, json=payload)
    return response.json()


if __name__ == "__main__":
    webhook_url = os.getenv("FEISHU_WEBHOOK_URL")
    
    if not webhook_url:
        print("❌ 未设置 FEISHU_WEBHOOK_URL 环境变量")
        print(f"请在 {ENV_FILE} 中添加:")
        print("FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/你的ID")
        exit(1)
    
    report = generate_report()
    print(report)
    
    print("\n📤 正在发送到飞书...")
    result = send_to_feishu(webhook_url, report)
    
    if result.get("code") == 0 or result.get("StatusCode") == 0:
        print("✅ 发送成功!")
    else:
        print(f"❌ 发送失败: {result}")
