**Title**
调整 CLI 欢迎横幅与输入区：极简暗色、版本号与执行路径

**Summary**
- 欢迎区保持居中布局（Blessed），但内容收敛为 Logo + 版本号 + 执行/授权路径。
- 输入区采用 Slate 极简风：暗色背景、低饱和边框，视觉与主内容有明确区隔。
- 输入区同一组件内包含两行：输入行 + 模型行（`Model: provider/model`）。
- 新增输入 placeholder，空输入可见，输入后隐藏，清空后回显。

**Implementation Changes**
- `src/apps/cli/components/input_manager.ts`:
  - `buildLogoContent`：欢迎页展示改为 `版本号` 与 `执行/授权路径`。
  - 版本号回退值改为 `unknown`（不再显示 `dev`）。
  - 输入区样式改为 Slate token：
    - `bg: #11161c`
    - `border: #3a5566`
    - 输入主文字 `#d7e0e7`
    - 模型行弱化为灰色
  - 输入容器宽度收窄：welcome `64%`，chat `72%`。
  - 输入行纵向位置下移（避免视觉贴顶）。
  - 增加 `inputPlaceholder` 与 `refreshInputPlaceholder()`，统一处理显示/隐藏。

**Test Plan**
- 启动 CLI：欢迎页显示 `版本号` 与 `执行/授权路径`，不再显示 Provider/快捷键文案。
- 输入框空态可见 placeholder；开始输入后消失；删除为空后再次出现。
- 执行 `/model`、`/provider` 后，输入框下方模型行即时更新。
- 运行 `npm run build` 通过。

**Assumptions**
- 默认授权路径即当前执行路径（`process.cwd()`），不提供单独授权路径配置入口。
- 终端支持基本 ANSI 颜色；低能力终端按 Blessed 默认能力降级显示。
