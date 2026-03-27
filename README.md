# CodeAgent (MVP)

CodeAgent is an AI-powered coding assistant that can plan and execute complex development tasks by interacting directly with your local environment.

## Features

- **Advanced Toolset**: Read/Write files, run shell commands, structured directory listing, global text search, and precise content replacement.
- **Task Planning**: Decomposes complex user objectives into actionable multi-step plans.
- **Self-Correction**: Automatically analyzes command errors (stderr) and attempts to fix them.
- **Safety Guards**: Workspace path validation, command blocklist, and **Human-in-the-Loop (HITL)** for sensitive operations.
- **Memory Management**: Token-aware sliding window memory (~4000 tokens) ensuring context stability.
- **Session Persistence (SQLite)**: Runtime-owned sessions with resume support across restarts (CLI only renders and routes).
- **Observability**: Real-time token usage display and detailed turn-by-turn action logging.
- **Multi-Provider LLM**: Register OpenAI/Anthropic/Zhipu (zai)/Minimax via `.env`, switch at runtime with `/model`.
- **Ink CLI UX**: Full-screen Ink TUI with welcome mode + chat mode, modal overlays, slash popup, and keyboard shortcuts.
- **Structured Chat Timeline**: Chat page renders user, assistant, system, and error messages as message blocks instead of a flat log stream; reasoning is separated from the final answer.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [npm](https://www.npmjs.com/)
- A terminal that supports Ink/TTY interactive rendering.
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

### Interactive Mode (Ink CLI)
Run the agent in a continuous interactive session:
```bash
npm start
```
Or use the global command if installed:
```bash
codeagent
```

### Slash Commands
- `/help`: Show commands, config hints, and keybindings.
- `/model`: Interactively switch model under current provider.
- `/new`: Create and switch to a new session (old sessions remain resumable).
- `/history`: Show recent sessions.
- `/resume`: Continue the latest saved session.

### Keybindings
- `Ctrl+C`: Interrupt current task; press again to exit when idle.
- `Ctrl+D`: Exit.
- `Esc`: Close modal overlays or cancel the current modal flow.
- `Tab` / `Up` / `Down` / `Esc` / `Enter`: Slash popup selection and completion.

## Testing

Run unit tests:
```bash
npm run test:unit
```

Run the full test suite (may require real provider keys for integration/e2e):
```bash
npm test
```

## Project Structure (Hexagonal Architecture)

```
src/
├── core/                    # Core business logic (no UI dependencies)
│   ├── controller/          # Agent and Planner logic
│   ├── llm/                 # LLM provider implementations
│   ├── tools/               # Core execution tools
│   ├── interfaces/          # IUIAdapter definitions
│   ├── prompts/             # System prompts
│   └── session/             # Session service + repository + sqlite storage
│
├── apps/                    # Application entry points
│   ├── cli/                 # Ink interactive interface
│   └── kernel/              # JSON-RPC kernel (for desktop app integration)
│
├── tests/                   # Integration and unit tests
└── web/                     # Web search and browsing tools
```

## Session Storage

- Default DB path: `~/.codeagent/sessions.db` (Windows: `%USERPROFILE%\\.codeagent\\sessions.db`).
- Override DB path with env: `CODEAGENT_SESSION_DB=...`
- Runtime tries `bun:sqlite` first; if unavailable, falls back to `node:sqlite`.

## CLI Runtime Notes

- Entry: `src/apps/cli/index.ts`
- UI runtime entry: `src/apps/cli/ink/pi_app.tsx`
- Chat page now uses a structured message model instead of flat line-based rendering.
- UI adapter is fixed for session lifecycle (no runtime adapter swapping).
- Legacy Blessed-era files such as `repl.ts` and `blessed_welcome.ts` have been removed from the CLI codebase.

## Web Tools (F5)

- `web_search`: Real-time web search (provider-based).
- `browse_page`: Fetch and extract main page content with summary.

See `docs/archive/legacy_functional_requirements/F5_浏览器增强.md` and related implementation plan for configuration and safety rules.
