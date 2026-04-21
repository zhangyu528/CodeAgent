# SPEC: Session Manager Test Hardening

## Objective

修复 `tests/unit/agent/sessions.test.ts` 中的 15 个测试失败。问题根源是测试文件错误地尝试通过 `SessionManager` 实例访问 `normalizeSessionRecord()` 和 `extractTitle()`，但这两个函数是 `sessionService.ts` 的独立导出函数，不是 `SessionManager` 的方法。

## ASSUMPTIONS

1. `normalizeSessionRecord()` 和 `extractTitle()` 是 `sessionService.ts` 导出的独立函数，不是 `SessionManager` 的方法
2. 测试应该直接从 `sessionService.ts` 导入这些函数
3. `SessionManager` 通过组合使用 `sessionService` 导出的函数
4. Node.js `fsp.readdir(SESSIONS_DIR, { withFileTypes: false })` 返回 `string[]`

## Tech Stack

- Vitest (测试框架)
- TypeScript
- Node.js `fs`/`fsp` 模块

## Project Structure

```
src/agent/
├── sessions.ts              # SessionManager 类
├── sessionService.ts       # normalizeSessionRecord, extractTitle, buildSessionDocument
├── sessionUtils.ts         # isValidSessionId, extractMessageText

tests/unit/agent/
├── sessions.test.ts         # SessionManager 单元测试
```

## Code Style

```typescript
// 错误方式 - 测试尝试访问不存在的实例方法
const result = (sessionManager as any).normalizeSessionRecord('fallback', data);

// 正确方式 - 直接从 sessionService 导入
import { normalizeSessionRecord } from '../../../src/agent/sessionService';
const result = normalizeSessionRecord('fallback', data);
```

## Testing Strategy

- 使用 Vitest 进行测试
- 使用 `vi.mock` 模拟 `fs`/`fsp` 模块
- `normalizeSessionRecord()` 和 `extractTitle()` 的测试直接从 `sessionService.ts` 导入

## Success Criteria

- [ ] 所有 15 个失败测试通过
- [ ] `normalizeSessionRecord()` 测试直接从 `sessionService.ts` 导入函数
- [ ] `extractTitle()` 测试直接从 `sessionService.ts` 导入函数
- [ ] 所有 1021 个测试通过

## Open Questions

无
