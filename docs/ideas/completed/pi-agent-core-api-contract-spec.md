# SPEC: pi-agent-core API Contract & Version Pinning

## Objective

CodeAgent 依赖 `@mariozechner/pi-agent-core` 和 `@mariozechner/pi-ai`，当前 `package.json` 使用 `^0.61.1` 允许任意 minor/patch 升级引入 breaking change。这阻塞了 N3/N4/N5 的安全推进。本提案确保：

1. **严格版本锁定** — 避免上游悄然引入 breaking change
2. **运行时 API 契约验证** — 不仅检查版本号，还验证实际 API 可用性
3. **已知问题注册表** — 记录已知的上游问题，提供 workaround

## Tech Stack

- **框架**：TypeScript + Vitest
- **关键依赖**：
  - `@mariozechner/pi-agent-core: 0.61.1`（精确版本）
  - `@mariozechner/pi-ai: 0.61.1`（精确版本）
  - `zod: ^4.3.6`
- **Node.js**：>= 18

## Commands

```
构建: npm run build
测试: bun run test:run
类型检查: npx tsc --noEmit
```

## Project Structure

```
src/agent/
├── compatibilityCheck.ts      # 运行时兼容性检查（已有，待增强）
├── zod-compat.ts              # Zod 版本兼容层（已有）
├── sessionRepository.ts       # Session 存储抽象（N4）
└── ...                        # 其他 agent 核心文件

tests/unit/agent/
├── compatibilityCheck.test.ts # 兼容性检查测试（已有）
└── piAgentCoreContract.test.ts # API 契约测试（已有，待增强）
```

## Code Style

### API 契约检查模式

```typescript
// compatibilityCheck.ts — 增强版
interface CompatibilityError {
  package: string;
  api: string;
  expectedVersion: string;
  workaround?: string;
}

export function verifyAgentAPIs(): void {
  const agent = new Agent({ getApiKey: () => undefined });

  const apis = ['setModel', 'setTools'] as const;
  for (const api of apis) {
    if (typeof agent[api] !== 'function') {
      throw new CompatibilityError({
        package: 'pi-agent-core',
        api,
        expectedVersion: '0.61.1',
        workaround: '检查 pi-agent-core 版本或回退到 0.61.1',
      });
    }
  }
}

// KNOWN_ISSUES 注册表
const KNOWN_ISSUES: Record<string, IssueEntry> = {
  '0.62.0': {
    version: '0.62.0',
    issue: 'AgentMessage.content 从 string 变为 ContentBlock[]',
    workaround: '锁定到 0.61.1 直到修复发布',
  },
};
```

### package.json 锁定模式

```json
{
  "dependencies": {
    "@mariozechner/pi-agent-core": "0.61.1",
    "@mariozechner/pi-ai": "0.61.1"
  }
}
```

## Testing Strategy

- **测试框架**：Vitest
- **测试位置**：
  - `tests/unit/agent/compatibilityCheck.test.ts` — 现有测试扩展
  - `tests/unit/agent/piAgentCoreContract.test.ts` — 现有契约测试扩展
- **覆盖率要求**：API 契约测试覆盖所有 `pi-agent-core` 公开 API 使用点

## Boundaries

- **Always**：
  - 运行 `bun run test:run` 确认测试通过后再提交
  - 版本升级前必须审查 `pi-agent-core` changelog
  - 任何 `pi-agent-core` API 变更必须同步更新契约测试
- **Ask first**：
  - 升级 `pi-agent-core` 或 `pi-ai` 版本前
  - 修改 `compatibilityCheck.ts` 逻辑前
- **Never**：
  - 不经测试验证直接推送版本升级
  - 不在生产环境使用 `CONTINUE_WITH_COMPATIBILITY_ISSUES=1`

## Success Criteria

- [ ] `package.json` 中 `@mariozechner/pi-agent-core` 和 `@mariozechner/pi-ai` 锁定为精确版本 `0.61.1`
- [ ] `compatibilityCheck.ts` 包含 API surface 检查（`setModel`、`setTools` 等）
- [ ] `KNOWN_ISSUES` 注册表存在且包含至少当前已知问题
- [ ] 所有测试通过：`bun run test:run`
- [ ] `npx tsc --noEmit` 无错误

## Open Questions

1. 是否有私有 npm registry 可镜像 `pi-agent-core`，确保包始终可用？
2. 谁负责在版本升级前审查 `pi-agent-core` changelog？
3. 契约测试应该运行在 CI 还是仅在开发者机器上本地运行？
