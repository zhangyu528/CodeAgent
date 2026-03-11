# Feature 实操：F6 - 工作区授权 (Trust Mode)

为了防止 CodeAgent 在非预期目录（如包含敏感私钥目录、系统根目录）误启动并执行修改，我们引入了工作区授权机制。

## 1. 核心链路预览

### 首次启动拦截
当您在一个新目录首次运行 `codeagent` 或 `npm start` 时，系统会暂停初始化并弹出确认：

```text
[Security Warning] Detect start in untrusted directory: D:\work\project\SensitiveDir

? Do you trust this workspace and allow CodeAgent to access and modify files? (y/N)
```

- 如果选择 **No**：Agent 立即安全退出，不进行任何 API 调用。
- 如果选择 **Yes**：Agent 将此目录加入“信任白名单”并继续启动。

## 2. 授权持久化 (Zero-Touch Restart)

授权结果保存在您的用户主目录下：`~/.codeagent/config.json`。

```json
{
  "trustedWorkspaces": [
    "D:\\work\\project\\CodeAgent"
  ]
}
```

一旦授权成功，下次在同一目录启动将自动进入交互模式，无感丝滑。

## 3. 技术保障

- **Fail-closed**: 默认不信任，必须用户主动确认。
- **全局管理**: 配置文件不污染项目目录，删除项目不会丢失授权记录。
- **全量测试通过**: 已通过 `npm test` 全链路回归验证，确保授权逻辑不影响 Agent 的工具调用能力。

🏆 **CodeAgent 现在不仅强大，而且更安全、更可信。**
