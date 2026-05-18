# Agent Service 测试方案

本文档描述 agent-service 的自动化测试策略和方案。

## 测试框架

- **框架**: Vitest v2.0.0
- **环境**: Node.js
- **入口**: `src/agent-service/`
- **运行**: `npm test` (watch) / `npm run test:run` (单次)

## 测试类型

| 类型 | 目录 | 说明 |
|------|------|------|
| 单元测试 (Unit) | `tests/unit/` | 适配器层、工具函数 |
| 集成测试 (Integration) | `tests/integration/` | IPC 通道、事件、错误处理 |
| 服务测试 (Service) | `tests/service/` | Service 层返回类型 |
| 冒烟测试 (Smoke) | `tests/smoke/` | 核心功能快速验证 |
| 回归测试 (Regression) | `tests/regression/` | 关键路径保护 |
| 性能测试 (Performance) | `tests/performance/` | 计时和吞吐量 |
| 契约测试 (Contract) | `tests/contract/` | 接口契约验证 |
| 混沌测试 (Chaos) | `tests/chaos/` | 异常情况处理 |
| 快照测试 (Snapshot) | `tests/snapshot/` | 数据结构稳定性 |

## 测试目录结构

```
src/agent-service/tests/
├── smoke/                          # 冒烟测试
│   ├── service-init.test.ts         # 服务初始化
│   ├── ipc-channels.test.ts         # IPC 通道注册
│   └── session-operations.test.ts    # 基本 session 操作
├── regression/                      # 回归测试
│   ├── session-switching.test.ts    # session 切换
│   ├── prompt-handling.test.ts       # prompt 处理
│   └── error-handling.test.ts       # 错误处理
├── performance/                     # 性能测试
│   ├── concurrent-sessions.test.ts  # 并发 session
│   ├── large-messages.test.ts       # 大消息处理
│   └── jsonl-parsing.test.ts        # JSONL 解析
├── contract/                        # 契约测试
│   ├── handler-signatures.test.ts   # 处理器签名
│   └── return-types.test.ts         # 返回类型
├── chaos/                           # 混沌测试
│   ├── corrupted-session.test.ts    # 损坏文件
│   ├── invalid-paths.test.ts        # 无效路径
│   └── missing-dirs.test.ts         # 缺失目录
├── snapshot/                        # 快照测试
│   ├── ipc-return-values.test.ts    # IPC 返回值
│   └── session-headers.test.ts      # Session header
├── unit/                           # 单元测试
├── integration/                     # 集成测试
├── service/                        # 服务测试
├── setup.ts                        # 全局 setup
├── __fixtures__/sessions.ts         # 测试数据
└── __mocks__/agent.ts              # Mock 对象
```

## 运行测试

```bash
# 进入 agent-service 目录
cd src/agent-service

# 运行所有测试
npm run test:run

# 运行特定类型测试
npm run test:smoke        # 冒烟测试
npm run test:regression   # 回归测试
npm run test:performance  # 性能测试
npm run test:contract      # 契约测试
npm run test:chaos         # 混沌测试
npm run test:snapshot      # 快照测试

# Watch 模式
npm test
```

## 测试详情

### 冒烟测试 (smoke/)

快速验证核心功能是否正常，运行时 < 30 秒。

**service-init.test.ts**
- 服务初始化不抛错
- 服务暴露所有 required methods

**ipc-channels.test.ts**
- 所有 IPC 通道已注册
- Handler 可调用

**session-operations.test.ts**
- 创建/读取/切换 session 基本流程

### 回归测试 (regression/)

保护关键路径，确保核心功能不被破坏。

**session-switching.test.ts**
- 全局↔项目 session 切换
- 空 path 抛出描述性错误

**prompt-handling.test.ts**
- 有 session 时 prompt 返回结构正确
- 无 session 时返回错误或抛出

**error-handling.test.ts**
- 无效 session path 抛出
- 服务在错误后能恢复

### 性能测试 (performance/)

测量关键操作的执行时间。

**concurrent-sessions.test.ts**
- 5 个 session 并发创建 < 500ms
- 10+ sessions 列表 < 100ms

**large-messages.test.ts**
- SAMPLE_MESSAGES_LONG 解析
- 100+ 消息 session 文件处理

**jsonl-parsing.test.ts**
- 混合内容类型解析
- 1000 行 session < 50ms

### 契约测试 (contract/)

验证 IPC 接口契约的兼容性。

**handler-signatures.test.ts**
- 验证各 handler 参数/返回值结构

**return-types.test.ts**
- Session 对象包含: id, path, cwd, name?, created, modified, messageCount
- SessionGroup 包含: global[], byProject{}

### 混沌测试 (chaos/)

测试系统在异常情况下的鲁棒性。

**corrupted-session.test.ts**
- 无效 JSON 解析
- 缺失必需 header 字段
- 空文件处理

**invalid-paths.test.ts**
- 切换到不存在 path
- 切换到目录而非文件

**missing-dirs.test.ts**
- sessions 目录缺失时列表操作
- 无 session 时获取 stats

### 快照测试 (snapshot/)

验证数据结构的稳定性。

**ipc-return-values.test.ts**
- init() 返回值结构
- listSessions() 返回数组结构

**session-headers.test.ts**
- GLOBAL_SESSION_HEADER 结构
- PROJECT_SESSION_HEADER 结构

## 测试数据 (Fixtures)

位置: `tests/__fixtures__/sessions.ts`

```typescript
// 测试目录
TEST_AGENT_DIR      // 临时测试目录
SESSIONS_DIR       // sessions 子目录
GLOBAL_DIR         // 全局 session 目录
PROJECT_DIR         // 项目 session 目录

// Session 文件
GLOBAL_SESSION_FILE
PROJECT_SESSION_FILE

// Session Header
GLOBAL_SESSION_HEADER = {
  id: string,
  type: 'session',
  version: 2,
  timestamp: number,
  name: string,
  cwd: ''
}

PROJECT_SESSION_HEADER = {
  ...GLOBAL_SESSION_HEADER,
  cwd: 'D:\\work\\project\\Test'  // 非空
}

// 示例消息
SAMPLE_MESSAGES       // 简短对话
SAMPLE_MESSAGES_LONG  // 包含 toolCall 的长对话
```

## Mock 对象

位置: `tests/__mocks__/agent.ts`

```typescript
mockAgentSession    // AgentSession mock
mockSessionManager  // SessionManager mock
```

## 覆盖率配置

```typescript
// vitest.config.ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['src/**/*.ts'],
  exclude: ['src/**/*.d.ts'],
}
```

## 注意事项

1. **Session 状态**: 某些测试需要 active session，测试间可能共享状态
2. **并发测试**: 性能测试中的并发操作使用 `Promise.all`
3. **错误处理**: 混沌测试验证系统在异常情况下的行为，可能抛出错误
4. **路径编码**: 项目路径使用特殊编码 `--D--work-project-Test--`

## CI 集成建议

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: cd src/agent-service && bun install
      - run: cd src/agent-service && bun run test:run
```

## 扩展测试类型

如需添加更多测试类型，建议：

1. **E2E 测试**: 使用 Playwright/Selenium 测试完整用户流程
2. **属性测试 (Property-based)**: 使用 fast-check 生成随机输入
3. **突变测试 (Mutation)**: 使用 Stryker 验证测试有效性
4. **基准测试 (Benchmark)**: 使用 Vitest bench 进行微基准测试