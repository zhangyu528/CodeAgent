# SPEC: CI Quality Gate Automation

## Objective

为 CodeAgent 建立自动化 CI 质量门禁，确保代码质量持续可控：

1. **ESLint 配置缺失** — 当前 `lint-staged` 配置了 `eslint --fix`，但没有 `.eslintrc.json`，导致 ESLint 检查静默失效（0/1 通过）
2. **CI 测试作业依赖错误** — `test` job 声明 `needs: [lint, typecheck, audit, bundlesize]`，但实际没有等待这些作业的输出
3. **质量问题无法拦截** — 没有自动化检查在 PR 层面阻止低质量代码合并

**用户故事**：

- 作为开发者，我希望提交代码时自动运行 lint 检查，确保代码符合规范
- 作为维护者，我希望 CI 自动拦截 lint 错误和测试失败，防止低质量代码进入 main 分支

## ASSUMPTIONS I'M MAKING

1. Bun 作为运行时，ESLint 通过 `@typescript-eslint/parser` 支持 TypeScript
2. Vitest 测试结果可通过 `junit` reporter 被 CI 消费（已安装 `@vitest/coverage-v8`）
3. Husky pre-commit hook 已正确配置（husky 9.1.7 + lint-staged 16.4.0）
4. 现有 1049 个测试全部通过，无需修复 regex

## Tech Stack

- **Linter**: ESLint 9 + `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`
- **Formatter**: Prettier 3.8
- **Test**: Vitest 4.1
- **CI**: GitHub Actions
- **Runtime**: Bun

关键依赖（已存在于 `devDependencies`）：

```json
"eslint": "9",
"@eslint/js": "^10.0.1",
"@typescript-eslint/eslint-plugin": "^8.58.1",
"@typescript-eslint/parser": "^8.58.1",
"eslint-config-prettier": "^10.1.8",
"eslint-plugin-react-hooks": "^7.0.1",
"typescript-eslint": "^8.58.1"
```

## Commands

```bash
# 本地开发
bun run lint          # 运行 ESLint 检查
bun run lint:fix      # ESLint 自动修复
bun run test:run      # 运行所有测试

# CI 命令
bun run lint          # ESLint 检查（ESLint 配置存在后）
bun run typecheck     # TypeScript 类型检查
bun run test:run      # 测试（CI 中带 junit 输出）
```

## Project Structure

```
.eslintrc.json          # ESLint 配置（新增）
.eslintignore           # ESLint 忽略文件（新增）
.github/workflows/ci.yml  # CI 工作流（修改）
scripts/lint-check.sh   # lint 检查脚本（新增）
```

## Code Style

### ESLint 配置原则

使用 `typescript-eslint` 的 `recommended` 规则集，结合 `react-hooks` 规则：

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint", "react-hooks"],
  "rules": {
    // 关键规则覆盖
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}
```

### 关键规则说明

| 规则                                 | 级别  | 说明                            |
| ------------------------------------ | ----- | ------------------------------- |
| `no-console`                         | warn  | 允许 `warn`/`error`，禁止 `log` |
| `@typescript-eslint/no-unused-vars`  | error | 未使用变量报错                  |
| `@typescript-eslint/no-explicit-any` | warn  | 禁止 `any` 类型                 |
| `react-hooks/rules-of-hooks`         | error | Hook 规则强制执行               |
| `react-hooks/exhaustive-deps`        | warn  | 依赖数组完整性                  |

## Testing Strategy

### 本地开发

- `bun run lint` — lint 检查，不自动修复
- `lint-staged` 在 pre-commit 时运行 `eslint --fix` + `prettier --write`

### CI 流水线

```
lint → typecheck → test
         ↓
      audit → bundlesize
```

**失败策略**：

- `lint` 失败 → 整个流水线失败（最快反馈）
- `typecheck` 失败 → 流水线失败
- `test` 失败 → 流水线失败

## Boundaries

- **Always**:
  - 所有 PR 必须通过 lint + typecheck + test
  - 使用 `--max-warnings=0` 确保警告也会导致 CI 失败
  - ESLint 配置使用 `prettier` 扩展避免冲突

- **Ask first**:
  - 修改 CI workflow 结构
  - 添加新的 lint 规则或修改规则级别
  - 修改 pre-commit hook 配置

- **Never**:
  - 在 CI 中使用 `eslint --fix`（可能导致不可逆的代码变更）
  - 跳过 lint 检查来"解决" lint 错误
  - 提交包含 `console.log`（允许 `warn`/`error`）的代码

## Success Criteria

1. ✅ `bun run lint` 在本地运行成功，无 ESLint 错误
2. ✅ CI workflow 中 `lint` job 正确运行并报告结果
3. ✅ `lint` job 失败时，整个 CI 流水线失败
4. ✅ `test` job 在 `lint` 和 `typecheck` 都通过后才运行
5. ✅ `scripts/lint-check.sh` 存在且可独立运行
6. ✅ Husky pre-commit hook 能正确调用 ESLint

## Open Questions

1. **ESLint errors 是否应该 fail CI？** — 建议：errors fail，warnings logged
2. **是否需要 `lint:fix` 脚本？** — 建议：不需要，lint-staged 已处理自动修复
3. **是否需要在 CI 生成 junit 格式的测试报告？** — 建议：先不加，MVP 范围外
