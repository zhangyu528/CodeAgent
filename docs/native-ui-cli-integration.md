# Native UI 调用 CLI Interface 集成指南

本文档详细说明了在macOS平台上，各种Native UI应用如何调用Code Agent的CLI Interface，包括技术实现方案和具体代码示例。

## 目录

1. [进程调用方式](#1-进程调用方式)
2. [系统调用对比](#2-系统调用对比)
3. [实际应用场景](#3-实际应用场景)
4. [高级集成方式](#4-高级集成方式)
5. [macOS特有集成](#5-macos特有集成)
6. [管道集成方式](#6-管道集成方式)

## 1. 进程调用方式

### Electron应用
```javascript
// Electron主进程中调用CLI
const { spawn } = require('child_process');

function callAgentCLI(task) {
  return new Promise((resolve, reject) => {
    const process = spawn('./bin/agent', ['run', task], {
      cwd: '/path/to/codeagent',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        reject(new Error(`CLI exited with code ${code}: ${errorOutput}`));
      }
    });
  });
}

// 使用示例
callAgentCLI('优化这个函数的性能')
  .then(result => console.log(result.output))
  .catch(error => console.error(error));
```

### Swift/macOS原生应用
```swift
import Foundation

class AgentCLIClient {
    static func shared = AgentCLIClient()
    
    private let agentPath: String
    
    init() {
        // CLI工具的路径
        agentPath = "/usr/local/bin/agent" // 或者项目的相对路径
    }
    
    func callAgent(task: String) async throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: agentPath)
        process.arguments = ["run", task]
        
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe
        
        try process.run()
        process.waitUntilExit()
        
        let stdoutData = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
        let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
        
        let output = String(data: stdoutData, encoding: .utf8) ?? ""
        let errorOutput = String(data: stderrData, encoding: .utf8) ?? ""
        
        if process.terminationStatus == 0 {
            return output
        } else {
            throw AgentError.cliError(process.terminationStatus, errorOutput)
        }
    }
    
    func callAgentStream(task: String) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: agentPath)
            process.arguments = ["run", "--stream", task]
            
            let stdoutPipe = Pipe()
            process.standardOutput = stdoutPipe
            
            // 监听输出
            stdoutPipe.fileHandleForReading.readabilityHandler = { handle in
                let data = handle.availableData
                if let string = String(data: data, encoding: .utf8), !string.isEmpty {
                    continuation.yield(string)
                }
            }
            
            process.terminationHandler = { _ in
                continuation.finish()
            }
            
            do {
                try process.run()
            } catch {
                continuation.finish(throwing: error)
            }
        }
    }
}

enum AgentError: Error {
    case cliError(Int32, String)
    case processNotFound
}
```

## 2. 系统调用对比

### Node.js (Electron/VS Code Extension)
```javascript
// 方式1: spawn (推荐，支持流式输出)
const { spawn } = require('child_process');

function callAgentWithSpawn(task) {
  return new Promise((resolve, reject) => {
    const agent = spawn('agent', ['run', task], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    agent.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      // 实时处理输出
      console.log('实时输出:', chunk);
    });
    
    agent.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    agent.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`执行失败: ${stderr}`));
      }
    });
  });
}

// 方式2: exec (简单，一次性获取结果)
const { exec } = require('child_process');

function callAgentWithExec(task) {
  return new Promise((resolve, reject) => {
    exec(`agent run "${task}"`, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

// 方式3: execFile (更安全，避免shell注入)
const { execFile } = require('child_process');

function callAgentWithExecFile(task) {
  return new Promise((resolve, reject) => {
    execFile('agent', ['run', task], (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}
```

### Python (如果用Python写UI)
```python
import subprocess
import asyncio
from typing import AsyncIterator

class AgentCLIClient:
    def __init__(self, agent_path: str = "./bin/agent"):
        self.agent_path = agent_path
    
    async def call_agent_async(self, task: str) -> str:
        """异步调用CLI"""
        process = await asyncio.create_subprocess_exec(
            self.agent_path, 'run', task,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            return stdout.decode('utf-8')
        else:
            raise Exception(f"CLI failed with code {process.returncode}: {stderr.decode('utf-8')}")
    
    def call_agent_sync(self, task: str) -> str:
        """同步调用CLI"""
        result = subprocess.run(
            [self.agent_path, 'run', task],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            return result.stdout
        else:
            raise Exception(f"CLI failed: {result.stderr}")
    
    async def call_agent_stream(self, task: str) -> AsyncIterator[str]:
        """流式调用CLI"""
        process = await asyncio.create_subprocess_exec(
            self.agent_path, 'run', '--stream', task,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            yield line.decode('utf-8').rstrip()
        
        await process.wait()
        
        if process.returncode != 0:
            stderr = await process.stderr.read()
            raise Exception(f"CLI failed: {stderr.decode('utf-8')}")

# 使用示例
client = AgentCLIClient()

# 同步调用
try:
    result = client.call_agent_sync("优化这个函数")
    print(result)
except Exception as e:
    print(f"错误: {e}")

# 异步调用
async def main():
    try:
        result = await client.call_agent_async("分析代码结构")
        print(result)
    except Exception as e:
        print(f"错误: {e}")

# 流式调用
async def stream_example():
    try:
        async for line in client.call_agent_stream("重构这个模块"):
            print(f"实时输出: {line}")
    except Exception as e:
        print(f"错误: {e}")
```

## 3. 实际应用场景

### VS Code Extension
```typescript
// extension.ts
import * as vscode from 'vscode';
import { exec, spawn } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  // 注册命令：优化当前文件
  const optimizeCommand = vscode.commands.registerCommand(
    'agent.optimizeCurrentFile', 
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('请先打开一个文件');
        return;
      }
      
      const fileName = editor.document.fileName;
      const task = `优化文件: ${fileName}`;
      
      await executeWithProgress(task, '正在优化代码...');
    }
  );
  
  // 注册命令：分析项目
  const analyzeCommand = vscode.commands.registerCommand(
    'agent.analyzeProject',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('请先打开一个工作区');
        return;
      }
      
      const task = `分析项目: ${workspaceFolder.name}`;
      await executeWithProgress(task, '正在分析项目...');
    }
  );
  
  // 注册命令：生成测试
  const generateTestCommand = vscode.commands.registerCommand(
    'agent.generateTests',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      
      if (!selectedText) {
        vscode.window.showWarningMessage('请先选择要生成测试的代码');
        return;
      }
      
      const task = `为以下代码生成单元测试:\n${selectedText}`;
      await executeWithProgress(task, '正在生成测试...');
    }
  );
  
  context.subscriptions.push(optimizeCommand, analyzeCommand, generateTestCommand);
}

async function executeWithProgress(task: string, title: string) {
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: title,
    cancellable: true
  }, async (progress, token) => {
    return new Promise((resolve, reject) => {
      const agent = spawn('agent', ['run', task]);
      let output = '';
      
      agent.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        progress.report({ message: chunk.substring(0, 50) + '...' });
      });
      
      agent.stderr.on('data', (data) => {
        console.error('Agent错误:', data.toString());
      });
      
      agent.on('close', (code) => {
        if (code === 0) {
          // 显示结果在新标签页
          vscode.workspace.openTextDocument({
            content: output,
            language: 'markdown'
          }).then(doc => {
            vscode.window.showTextDocument(doc);
          });
          resolve(output);
        } else {
          vscode.window.showErrorMessage(`Agent执行失败，退出码: ${code}`);
          reject(new Error(`CLI failed with code ${code}`));
        }
      });
      
      token.onCancellationRequested(() => {
        agent.kill();
        reject(new Error('用户取消操作'));
      });
    });
  });
}
```

### macOS菜单栏应用
```swift
// AppDelegate.swift
import Cocoa
import Foundation

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem!
    var agentClient = AgentCLIClient.shared
    
    func applicationDidFinishLaunching(_ aNotification: Notification) {
        setupStatusBar()
    }
    
    func setupStatusBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.title = "🤖"
        statusItem.button?.toolTip = "Code Agent"
        
        let menu = NSMenu()
        
        // 优化当前项目
        menu.addItem(NSMenuItem(title: "优化当前项目", action: #selector(optimizeProject), keyEquivalent: "o"))
        
        // 分析代码结构
        menu.addItem(NSMenuItem(title: "分析代码结构", action: #selector(analyzeStructure), keyEquivalent: "a"))
        
        // 生成文档
        menu.addItem(NSMenuItem(title: "生成项目文档", action: #selector(generateDocs), keyEquivalent: "d"))
        
        menu.separator()
        
        // 配置
        menu.addItem(NSMenuItem(title: "配置", action: #selector(openConfig), keyEquivalent: ","))
        
        menu.separator()
        
        // 退出
        menu.addItem(NSMenuItem(title: "退出", action: #selector(quitApp), keyEquivalent: "q"))
        
        statusItem.menu = menu
    }
    
    @objc func optimizeProject() {
        executeAgentTask("优化当前项目的性能和结构", title: "优化项目")
    }
    
    @objc func analyzeStructure() {
        executeAgentTask("分析项目的代码结构和依赖关系", title: "分析结构")
    }
    
    @objc func generateDocs() {
        executeAgentTask("为项目生成完整的API文档", title: "生成文档")
    }
    
    @objc func openConfig() {
        // 打开配置窗口
        let configWindow = ConfigWindowController()
        configWindow.showWindow(nil)
    }
    
    @objc func quitApp() {
        NSApplication.shared.terminate(nil)
    }
    
    private func executeAgentTask(_ task: String, title: String) {
        Task {
            showNotification(title: "\(title)中...", message: "Agent正在处理任务")
            
            do {
                let result = try await agentClient.callAgent(task: task)
                showNotification(title: "\(title)完成", message: "任务执行成功")
                
                // 显示结果窗口
                let resultWindow = ResultWindowController()
                resultWindow.setContent(title: title, content: result)
                resultWindow.showWindow(nil)
            } catch {
                showNotification(title: "\(title)失败", message: error.localizedDescription)
            }
        }
    }
    
    private func showNotification(title: String, message: String) {
        let notification = NSUserNotification()
        notification.title = title
        notification.informativeText = message
        notification.soundName = NSUserNotificationDefaultSoundName
        NSUserNotificationCenter.default.deliver(notification)
    }
}

// ResultWindowController.swift
class ResultWindowController: NSWindowController {
    @IBOutlet weak var textView: NSTextView!
    
    override func windowDidLoad() {
        super.windowDidLoad()
        // 设置窗口属性
        window?.titlebarAppearsTransparent = true
        window?.titleVisibility = .hidden
    }
    
    func setContent(title: String, content: String) {
        window?.title = title
        textView?.string = content
    }
}
```

## 4. 高级集成方式

### WebSocket桥接
```typescript
// CLI Interface支持WebSocket模式
// bin/agent.ts
import { Command } from 'commander';
import { WebSocketServer } from 'ws';

const program = new Command();

program
  .command('websocket')
  .option('--port <port>', 'WebSocket端口', '8080')
  .option('--host <host>', 'WebSocket主机', 'localhost')
  .action(async (options) => {
    const wss = new WebSocketServer({ 
      port: options.port,
      host: options.host 
    });
    
    console.log(`WebSocket服务器启动在 ws://${options.host}:${options.port}`);
    
    wss.on('connection', (ws, request) => {
      console.log('新客户端连接');
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          const { type, task, sessionId } = message;
          
          if (type === 'execute') {
            // 发送开始信号
            ws.send(JSON.stringify({
              type: 'start',
              sessionId,
              timestamp: Date.now()
            }));
            
            // 流式执行任务
            for await (const chunk of executeTaskStream(task)) {
              ws.send(JSON.stringify({
                type: 'progress',
                sessionId,
                data: chunk,
                timestamp: Date.now()
              }));
            }
            
            // 发送完成信号
            ws.send(JSON.stringify({
              type: 'complete',
              sessionId,
              timestamp: Date.now()
            }));
          }
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: error.message,
            timestamp: Date.now()
          }));
        }
      });
      
      ws.on('close', () => {
        console.log('客户端断开连接');
      });
    });
  });

async function* executeTaskStream(task: string): AsyncGenerator<string> {
  // 模拟流式执行
  yield "开始分析任务...";
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  yield "正在处理代码...";
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  yield "生成优化建议...";
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  yield "任务完成！";
}
```

### Native UI WebSocket客户端
```javascript
// React Native或Flutter应用中的WebSocket客户端
class AgentWebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.handlers = new Map();
  }
  
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('连接到Agent WebSocket服务器');
        resolve();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket连接错误:', error);
        reject(error);
      };
      
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        const handler = this.handlers.get(message.sessionId);
        if (handler) {
          handler(message);
        }
      };
    });
  }
  
  async executeTask(task, onProgress) {
    const sessionId = this.generateSessionId();
    
    return new Promise((resolve, reject) => {
      // 注册处理器
      this.handlers.set(sessionId, (message) => {
        switch (message.type) {
          case 'start':
            onProgress?.('开始执行任务...');
            break;
          case 'progress':
            onProgress?.(message.data);
            break;
          case 'complete':
            this.handlers.delete(sessionId);
            resolve();
            break;
          case 'error':
            this.handlers.delete(sessionId);
            reject(new Error(message.error));
            break;
        }
      });
      
      // 发送执行请求
      this.ws.send(JSON.stringify({
        type: 'execute',
        task,
        sessionId
      }));
    });
  }
  
  generateSessionId() {
    return Math.random().toString(36).substr(2, 9);
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// 使用示例
const client = new AgentWebSocketClient('ws://localhost:8080');

async function main() {
  try {
    await client.connect();
    
    await client.executeTask(
      '优化这个React组件',
      (progress) => {
        console.log('进度:', progress);
      }
    );
    
    console.log('任务完成！');
  } catch (error) {
    console.error('执行失败:', error);
  } finally {
    client.disconnect();
  }
}
```

## 5. macOS特有集成

### Automator集成
```bash
# 创建Automator Action，调用CLI
#!/bin/bash
# 接收输入参数
input="$1"

# 调用Agent CLI
/usr/local/bin/agent run "处理: $input"

# 返回结果给Automator
echo "处理完成"
```

### Alfred Workflow
```python
# Alfred脚本过滤器 (Python)
import sys
import subprocess
import json

def main():
    # 获取Alfred查询参数
    query = sys.argv[1] if len(sys.argv) > 1 else ""
    
    if not query:
        # 返回空结果
        print(json.dumps({"items": []}))
        return
    
    try:
        # 调用Agent CLI
        result = subprocess.run(
            ['/usr/local/bin/agent', 'run', query],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            # 构造Alfred结果
            items = [{
                "title": "Agent执行结果",
                "subtitle": result.stdout[:100] + "..." if len(result.stdout) > 100 else result.stdout,
                "arg": result.stdout,
                "valid": True
            }]
            
            print(json.dumps({"items": items}))
        else:
            # 错误结果
            items = [{
                "title": "执行失败",
                "subtitle": result.stderr,
                "valid": False
            }]
            
            print(json.dumps({"items": items}))
            
    except subprocess.TimeoutExpired:
        items = [{
            "title": "执行超时",
            "subtitle": "Agent执行时间过长",
            "valid": False
        }]
        print(json.dumps({"items": items}))
    except Exception as e:
        items = [{
            "title": "系统错误",
            "subtitle": str(e),
            "valid": False
        }]
        print(json.dumps({"items": items}))

if __name__ == "__main__":
    main()
```

### Raycast Extension
```typescript
// Raycast扩展调用CLI
import { execSync } from 'child_process';
import { Cache, closeMainWindow, LaunchProps, showToast, Toast } from '@raycast/api';

interface AgentArguments {
  task: string;
}

export default async function Command(props: LaunchProps<{ arguments: AgentArguments }>) {
  const { task } = props.arguments;
  
  if (!task) {
    await showToast({
      style: Toast.Style.Failure,
      title: "错误",
      message: "请提供任务描述"
    });
    return;
  }
  
  try {
    // 显示加载提示
    const loadingToast = await showToast({
      style: Toast.Style.Animated,
      title: "Agent正在执行...",
      message: task
    });
    
    // 执行Agent CLI
    const result = execSync(`/usr/local/bin/agent run "${task}"`, {
      encoding: 'utf8',
      timeout: 30000
    });
    
    // 显示成功结果
    loadingToast.style = Toast.Style.Success;
    loadingToast.title = "执行完成";
    loadingToast.message = "任务执行成功";
    
    // 将结果复制到剪贴板
    await Cache.set('agent_result', result);
    
    // 关闭主窗口
    await closeMainWindow();
    
    // 显示结果预览
    await showToast({
      style: Toast.Style.Success,
      title: "结果已复制到剪贴板",
      message: result.substring(0, 50) + "..."
    });
    
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "执行失败",
      message: error.message
    });
  }
}

// 支持脚本参数
export default function Command() {
  return <List>
    <List.Item 
      title="执行Agent任务"
      subtitle="输入任务描述，让Agent帮你完成"
      actions={
        <ActionPanel>
          <Action 
            title="执行任务"
            onAction={async () => {
              // 获取用户输入
              const task = await showInput({
                title: "Agent任务",
                placeholder: "请描述你想要执行的任务..."
              });
              
              if (task) {
                await executeAgentTask(task);
              }
            }}
          />
        </ActionPanel>
      }
    />
  </List>;
}
```

### macOS Service集成
```swift
// macOS Service (使用NSPerformService)
import Cocoa
import Foundation

class AgentService: NSObject {
    static func registerService() {
        // 注册系统服务
        let service = NSNetService(domain: "", type: "_agent._tcp.", name: "CodeAgent", port: 8080)
        service.publish()
    }
    
    @objc func performService(_ pboard: NSPasteboard, userData: String, error: NSErrorPointer) {
        // 获取选中的文本
        if let selectedText = pboard.string(forType: .string) {
            Task {
                do {
                    let result = try await AgentCLIClient.shared.callAgent(task: "优化这段代码:\n\(selectedText)")
                    
                    // 将结果放回剪贴板
                    let pboard = NSPasteboard.general
                    pboard.clearContents()
                    pboard.setString(result, forType: .string)
                    
                    // 显示通知
                    DispatchQueue.main.async {
                        let notification = NSUserNotification()
                        notification.title = "Agent处理完成"
                        notification.informativeText = "结果已复制到剪贴板"
                        NSUserNotificationCenter.default.deliver(notification)
                    }
                } catch {
                    DispatchQueue.main.async {
                        let notification = NSUserNotification()
                        notification.title = "Agent处理失败"
                        notification.informativeText = error.localizedDescription
                        NSUserNotificationCenter.default.deliver(notification)
                    }
                }
            }
        }
    }
}
```

## 6. 管道集成方式

### CLI支持管道输入
```typescript
// bin/agent.ts - 支持管道输入
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

program
  .command('run [task]')
  .option('--pipe', '从标准输入读取任务')
  .option('--stream', '流式输出结果')
  .action(async (task, options) => {
    let taskContent = task;
    
    // 如果没有提供任务且启用了管道模式
    if (!taskContent && options.pipe) {
      taskContent = await readFromStdin();
    }
    
    if (!taskContent) {
      console.error('请提供任务描述或使用管道输入');
      process.exit(1);
    }
    
    try {
      if (options.stream) {
        // 流式输出
        for await (const chunk of executeTaskStream(taskContent)) {
          process.stdout.write(chunk);
        }
      } else {
        // 一次性输出
        const result = await controller.run(taskContent, model);
        console.log(result);
      }
    } catch (error) {
      console.error('执行失败:', error.message);
      process.exit(1);
    }
  });

async function readFromStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => data += chunk);
    process.stdin.on('end', () => resolve(data.trim()));
  });
}

// 支持管道输出的命令
program
  .command('process <task>')
  .description('处理标准输入的数据')
  .action(async (task) => {
    const transform = new AgentTransform(task);
    await pipeline(process.stdin, transform, process.stdout);
  });

class AgentTransform extends Transform {
  constructor(private task: string) {
    super({ objectMode: false });
  }
  
  async _transform(chunk: Buffer, encoding, callback) {
    try {
      const input = chunk.toString();
      const processedInput = `基于任务"${this.task}"处理输入: ${input}`;
      const result = await this.processInput(processedInput);
      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }
  
  private async processInput(input: string): Promise<string> {
    // 这里调用Agent处理输入
    return `Processed: ${input}\n`;
  }
}
```

### 管道使用示例
```bash
# 基础管道用法
echo "优化这个函数的性能" | agent run --pipe

# 从文件读取任务
cat task.txt | agent run --pipe

# 处理其他命令的输出
git diff --name-only | agent review-files

# 流式处理
git log --oneline -10 | agent analyze-commits --stream > analysis.md

# 复杂管道组合
find . -name "*.ts" | agent analyze-typescript | grep "potential_issues" | agent generate-fixes
```

### Native UI管道调用
```javascript
// Node.js中调用支持管道的CLI
function callAgentWithPipe(inputData, task) {
  return new Promise((resolve, reject) => {
    const agent = spawn('agent', ['run', '--pipe', task]);
    
    let output = '';
    let errorOutput = '';
    
    // 将输入数据写入stdin
    agent.stdin.write(inputData);
    agent.stdin.end();
    
    agent.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    agent.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    agent.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`CLI failed with code ${code}: ${errorOutput}`));
      }
    });
  });
}

// 使用示例：处理Git diff
const gitDiff = `diff --git a/src/app.ts b/src/app.ts
index 1234567..abcdefg 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,5 +1,5 @@
 function hello() {
-  console.log("Hello World");
+  console.log("Hello, Agent!");
 }
`;

callAgentWithPipe(gitDiff, '审查这段代码变更')
  .then(result => console.log('审查结果:', result))
  .catch(error => console.error('审查失败:', error));
```

## 总结

Native UI调用CLI Interface的主要方式包括：

1. **进程调用**: 最直接的方式，适用于所有Native应用
2. **WebSocket桥接**: 支持实时交互和流式输出
3. **系统集成**: 与macOS特性深度集成
4. **管道集成**: 支持Unix风格的命令组合

选择哪种方式取决于：
- **应用类型**: 桌面应用、移动应用还是Web应用
- **交互需求**: 是否需要实时反馈
- **集成深度**: 是否需要与系统功能深度集成
- **性能要求**: 是否需要处理大量数据

关键是CLI Interface需要设计得**程序友好**，支持：
- 结构化输出（JSON格式）
- 进度反馈和错误码
- 流式输出和管道支持
- 良好的错误处理

这样Native UI才能更好地与CLI进行交互，提供优秀的用户体验。
