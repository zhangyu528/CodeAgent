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

This project uses [vitest](https://vitest.dev/) for testing.

Run tests in watch mode:
```bash
bun test
```

Run all tests once:
```bash
bun run test:run
```

Run tests with UI:
```bash
bun run test:ui
```

## Project Structure

```
src/
├── agent/                    # Agent core business logic
│   ├── agent.ts             # Agent singleton factory
│   ├── config.ts            # Configuration
│   ├── model.ts             # LLM model resolution
│   ├── sessions.ts          # Session management
│   └── tools/               # Execution tools (read_file, write_file, run_command, list_directory)
│
├── apps/cli/                 # Ink CLI interface
│   ├── index.tsx            # CLI entry point
│   └── ink/                 # Ink components
│       ├── App.tsx          # Main Ink app
│       ├── components/      # UI components (modals, inputs, chat, debug)
│       ├── hooks/           # React hooks
│       ├── pages/           # Page components (welcome, chat, loading)
│       ├── store/           # State stores (session, chat, ui)
│       └── context/         # React context
│
├── docs/                    # Documentation and roadmaps
└── tests/                   # Unit and integration tests
```

## Configuration

Create a `.env` file in the project root with your provider API keys:

```bash
# Default provider: zai, openai, anthropic, minimax-cn
DEFAULT_PROVIDER=zai

# Provider API keys
ZAI_API_KEY=your_zai_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
MINIMAX_API_KEY=your_minimax_key
MINIMAX_API_BASE_URL=https://api.minimax.chat
```

## Quick Start

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Build for production
bun run build

# Run tests
bun run test:run
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
# test
# update
# test2
test3
# test post-commit python
# author test
