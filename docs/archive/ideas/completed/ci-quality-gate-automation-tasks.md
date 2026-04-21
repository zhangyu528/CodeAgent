# 任务拆分：CI Quality Gate Automation

## 关联 SPEC

- **规格文档**：docs/ideas/todo/ci-quality-gate-automation-spec.md

## Idea 信息

- **文件**：docs/ideas/todo/ci-quality-gate-automation.md
- **Problem Statement**：CodeAgent 的 CI pipeline 缺乏自动化质量门禁，ESLint 配置缺失，lint-staged 静默失效
- **MVP Scope**：
  1. 添加 `.eslintrc.json`
  2. 添加 `scripts/lint-check.sh`
  3. 更新 `.github/workflows/ci.yml`
  4. **不在 MVP 范围**：修复兼容性测试的 regex

## 任务列表

### Task 1: 创建 ESLint 配置文件

**验收标准**：

- [ ] `.eslintrc.json` 文件存在且语法正确
- [ ] ESLint 能成功解析 TypeScript 和 TSX 文件
- [ ] 使用 `typescript-eslint/recommended` + `react-hooks/recommended` + `prettier` 配置
- [ ] `bun run lint` 能成功运行（无配置错误）

**TDD 步骤**：

- RED：运行 `bun run lint` 确认 "Script not found"
- GREEN：创建 `.eslintrc.json` 并配置基础规则
- REFACTOR：验证配置是否正确加载

**文件**：

- `.eslintrc.json`（新增）
- `.eslintignore`（新增）

---

### Task 2: 创建 ESLint 忽略文件

**验收标准**：

- [ ] `.eslintignore` 存在且忽略 `dist/`、`node_modules/`、`.git/` 等目录
- [ ] ESLint 不会检查构建产物和依赖目录

**文件**：

- `.eslintignore`（新增）

---

### Task 3: 验证本地 lint 能正确运行

**验收标准**：

- [ ] `bun run lint` 能正常运行
- [ ] 报告当前 lint 错误/警告数量
- [ ] `lint-staged` 在 pre-commit 时能调用 ESLint

**验证**：

- 运行 `bun run lint` 并记录输出
- 运行 `echo "const x: number = 'str'" | tee /tmp/test.ts && bun lint /tmp/test.ts` 测试 ESLint 是否能检测错误

**文件**：

- 无新增文件
- 验证现有配置

---

### Task 4: 添加 lint 检查脚本

**验收标准**：

- [ ] `scripts/lint-check.sh` 存在
- [ ] 脚本运行 `bun run lint` 并在 ESLint 错误时返回非零退出码
- [ ] 脚本输出清晰的错误信息

**文件**：

- `scripts/lint-check.sh`（新增）

---

### Task 5: 修复 CI workflow 中的 test job 依赖问题

**验收标准**：

- [ ] `.github/workflows/ci.yml` 中 `test` job 正确声明 `needs: [lint, typecheck]`
- [ ] `lint` 和 `typecheck` 失败时，`test` job 不会运行
- [ ] `audit` 和 `bundlesize` 作业移除（或者改为 `optional: true`）

**文件**：

- `.github/workflows/ci.yml`（修改）

---

### Task 6: 验证 CI lint job 配置

**验收标准**：

- [ ] CI 的 `lint` job 使用 `bun run lint` 运行检查
- [ ] ESLint 错误导致 lint job 失败（非 warnings 时失败）
- [ ] CI 配置与本地 `lint-staged` 配置一致

**文件**：

- `.github/workflows/ci.yml`（验证）

---

## 任务执行顺序

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6
```

**依赖关系**：

- Task 3 依赖 Task 1 和 Task 2（需要 ESLint 配置存在）
- Task 4 依赖 Task 3（需要 lint 能运行）
- Task 5 可以与 Task 1-4 并行（独立文件）
- Task 6 依赖 Task 5

## 预估范围

- Task 1: S（新增单个配置文件）
- Task 2: XS（创建忽略文件）
- Task 3: S（验证配置）
- Task 4: XS（创建单行脚本）
- Task 5: S（修改单个 YAML 文件）
- Task 6: S（验证 CI 配置）

**总体预估**：Medium 范围，6 个小任务，无复杂依赖关系
