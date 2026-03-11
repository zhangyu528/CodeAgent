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

## Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [npm](https://www.npmjs.com/)
- At least one configured LLM provider in `.env` (see `.env.example`).

## Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Configure environment**:
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
- Type your instruction (e.g., "Create a file temp/test.txt")
- Type **exit** or **quit** to end the session.
- Type `/model` to show current/available providers.
- Type `/model <provider>` to switch provider (e.g., `/model deepseek`).

## Testing

Run the comprehensive integration test suite:
```bash
npm test
```

Other test scripts:
- `npm run test:agent`: Basic tool & ReAct loop test.
- `npm run test:planner`: Task decomposition test.

## Project Structure

- `src/index.ts`: CLI Entry point.
- `src/tools/`: Core execution tools.
- `src/controller/`: Agent and Planner logic.
- `src/llm/`: LLM provider implementations.
- `src/tests/`: Integration and unit tests.
## Web Tools (F5)

- web_search: Real-time web search (provider-based).
- rowse_page: Fetch and extract main page content with summary.

See docs/F5_BROWSER_ENHANCEMENT.md for configuration and safety rules.

