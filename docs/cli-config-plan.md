# CLI 配置管理需求与实现计划

本文档记录“配置管理能力”的需求、实现计划与落盘范围。

## 需求

- CLI 用户无需手动编辑 `.env` 即可读写配置。
- 支持常见配置项：API key、模型、超时、规划/日志开关。
- 明确优先级：CLI 参数 > 配置文件 > 环境变量。
- 本地配置文件具备最小安全性（权限 600）。

## 实现计划

1. **配置存储**
   - 新增 `ConfigStore` 读写 JSON 配置
   - 默认路径：`~/.codeagent/config.json`
   - 写入后 `chmod 600`

2. **配置优先级**
   - 新增 `resolveConfig()` 合并：
     - CLI 参数 > 配置文件 > 环境变量

3. **CLI 命令**
   - `codeagent config list`：输出当前值与来源
   - `codeagent config get <key>`：读取单项
   - `codeagent config set <key> <value>`：写入单项
   - 支持 `key=value` 形式与交互式输入

## 落盘范围

- `src/config/config-store.ts`
- `src/config/resolve-config.ts`
- `src/cli/index.ts`
- `package.json`（新增 CLI 脚本与依赖）
