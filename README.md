# CodeAgent

AI-powered terminal coding assistant built on [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent).

## 快速开始

### 环境要求

- [Bun](https://bun.sh/) v1.3+
- [Node.js](https://nodejs.org/) v22+ (for Electron)

### 安装

```bash
bun install
```

### CLI (终端应用)

```bash
bun run dev:cli      # 开发
bun run build:cli    # 构建
bun run start:cli    # 运行
```

### Electron (桌面应用)

```bash
bun run dev:electron        # 开发
bun run build:electron    # 构建
bun run start:electron    # 运行
bun run package:electron   # 打包 .exe
```

### 测试

```bash
bun run test          # 测试
bun run test:run      # 单次测试
```
