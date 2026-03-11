# CodeAgent (MVP)

CodeAgent is an AI-powered coding assistant that can plan and execute complex development tasks by interacting directly with your local environment.

## Features

- **Advanced Toolset**: Read/Write files, run shell commands, structured directory listing, global text search, and precise content replacement.
- **Task Planning**: Decomposes complex user objectives into actionable multi-step plans.
- **Self-Correction**: Automatically analyzes command errors (stderr) and attempts to fix them.
- **Safety Guards**: Workspace path validation, command blocklist, and **Human-in-the-Loop (HITL)** for sensitive operations.
- **Memory Management**: Token-aware sliding window memory (~4000 tokens) ensuring context stability.
- **Observability**: Real-time token usage display and detailed turn-by-turn action logging.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [npm](https://www.npmjs.com/)
- A valid GLM API Key (Zhipu AI).

## Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Configure environment**:
    Copy `.env.example` to `.env` and fill in your API key:
    ```bash
    cp .env.example .env
    ```
    Required field: `GLM_API_KEY`.

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
Once started, you can type instructions at the `CodeAgent >` prompt. The agent maintains context throughout the entire session.

### Commands inside REPL
- Type your instruction (e.g., "Create a file temp/test.txt")
- Type **exit** or **quit** to end the session.

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
