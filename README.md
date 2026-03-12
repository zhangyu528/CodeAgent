# CodeAgent (MVP)

CodeAgent is an AI-powered coding assistant that can plan and execute complex development tasks by interacting directly with your local environment.

## Features

- **Advanced Toolset**: Read/Write files, run shell commands, structured directory listing, global text search, and precise content replacement.
- **Task Planning**: Decomposes complex user objectives into actionable multi-step plans.
- **Self-Correction**: Automatically analyzes command errors (stderr) and attempts to fix them.
- **Safety Guards**: Workspace path validation, command blocklist, and **Human-in-the-Loop (HITL)** for sensitive operations.
- **Memory Management**: Token-aware sliding window memory (~4000 tokens) ensuring context stability.
- **Observability**: Real-time token usage display and detailed turn-by-turn action logging.
- **Multi-Provider LLM**: Register OpenAI/Anthropic/DeepSeek/Ollama (and legacy GLM) via `.env`, switch at runtime with `/model`.
- **CLI UX (F9)**: `/help`, status line (optional), tool bubbles (optional), and keybindings for interrupt/clear/exit.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [npm](https://www.npmjs.com/)
- At least one configured LLM provider in `.env` (see `.env.example`).

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Copy `.env.example` to `.env` and fill in your provider config:
   ```bash
   cp .env.example .env
   ```

## Usage

### Interactive Mode (Chat)
Run the agent in a continuous interactive session:
```bash
npm start
```
Or use the global command if installed:
```bash
codeagent
```

### Commands inside REPL
- `/help`: Show commands, config toggles, and keybindings.
- `/model [provider]`: Show current/available providers or switch provider.
- `/clear`: Clear conversation memory (and tool bubbles).
- `/history`: Show message count and approximate context tokens.
- `/tools`: List recent tool calls.
- `/tool <id>`: Inspect a tool call (args + result).
- `/edit`: Open editor to compose a prompt (TTY only).
- `<<EOF` ... `EOF`: Multiline input.
- `exit` / `quit`: Exit.

### Keybindings (TTY)
- `Ctrl+C`: Interrupt streaming/thinking; cancel multiline capture.
- `Ctrl+D`: Exit.
- `Ctrl+L`: Clear screen (keeps session).

## Testing

Run unit tests:
```bash
npm run test:unit
```

Run the full test suite (may require real provider keys for integration/e2e):
```bash
npm test
```

## Project Structure

- `src/index.ts`: CLI Entry point.
- `src/tools/`: Core execution tools.
- `src/controller/`: Agent and Planner logic.
- `src/llm/`: LLM provider implementations.
- `src/tests/`: Integration and unit tests.

## Web Tools (F5)

- `web_search`: Real-time web search (provider-based).
- `browse_page`: Fetch and extract main page content with summary.

See `docs/功能需求/F5_浏览器增强.md` and related implementation plan for configuration and safety rules.
