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

### Direct Mode (Single Task)
Run a specific instruction directly:
```bash
npm start
```
Then type your instruction at the `You >` prompt (e.g., "List files in src").

### Planner Mode (Complex Task)
Run multi-step tasks with automatic planning and execution:
```bash
npm run start:plan
```
Example: "Search for all TODOs in the project and save the results to a new file in temp/."

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
