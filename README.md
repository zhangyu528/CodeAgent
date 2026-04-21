# CodeAgent (MVP)

CodeAgent is an AI-powered terminal coding assistant built on [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent). It features a full-screen Ink TUI, structured chat timeline, slash commands, session persistence, and multi-provider LLM support.

## Features

- **Advanced Toolset**: Read/Write files, run shell commands, structured directory listing, text search via `@mariozechner/pi-coding-agent`.
- **Task Planning**: Decomposes complex user objectives into actionable multi-step plans.
- **Self-Correction**: Automatically analyzes command errors and attempts to fix them.
- **Safety Guards**: Workspace path validation, command blocklist, and **Human-in-the-Loop (HITL)** for sensitive operations.
- **Memory Management**: Token-aware sliding window memory (~4000 tokens) ensuring context stability.
- **Session Persistence (SQLite)**: Sessions saved to `~/.codeagent/sessions.db` with resume support.
- **Observability**: Real-time token usage display and detailed turn-by-turn action logging.
- **Multi-Provider LLM**: Register **Zhipu (zai)** / **Minimax** via `.env`, switch at runtime with `/model`.
- **Ink TUI**: Full-screen terminal UI with welcome mode + chat mode, modal overlays, slash command palette, and keyboard shortcuts.
- **Structured Chat Timeline**: Messages rendered as typed blocks (`text`, `thinking`, `reasoning`, `toolSummary`) with date-grouped history.
- **JSON Mode**: Non-interactive NDJSON output for shell piping (`--json --prompt "..."`).

## Prerequisites

- [Bun](https://bun.sh/) v1.3+
- A terminal that supports Ink/TTY interactive rendering (not Windows ConPTY — use WSL or Windows Terminal).
- At least one configured LLM provider in `.env` (see `.env.example`).

## Setup

```bash
# Install dependencies
bun install
```

Provider configuration is done **at runtime** via the `/model` command inside the TUI — no `.env` file is required for normal use. API keys are stored in `AuthStorage` (`~/.pi/agent/`).

## Usage

### Interactive Mode (Ink TUI)

```bash
bun run dev       # Development mode (with log viewer window)
bun run start     # Production build
npm start         # After npm link
codeagent         # After global install
```

### JSON Output Mode

```bash
codeagent --json --prompt "Explain this code" --session <session-id>
# Outputs NDJSON events to stdout:
# {"type":"response","content":"The code...","model":"..."}
```

### Slash Commands

| Command    | Description                                    |
| ---------- | ---------------------------------------------- |
| `/help`    | Show commands and keybindings                  |
| `/model`   | Interactively switch model / configure API key |
| `/new`     | Create and switch to a new session             |
| `/history` | Browse saved session history                   |
| `/resume`  | Resume the most recent session                 |

### Keybindings

- `Enter` / `Return`: Submit prompt or execute slash command
- `Backspace` / `Delete`: Delete last character
- `Escape`: Clear input field
- `↑` / `↓` / `PageUp` / `PageDown`: Navigate message history or slash command list
- `Ctrl+C` / `Ctrl+D`: Double-press to exit (first press shows a hint)

## Testing

```bash
bun test              # Watch mode
bun run test:run      # Single run
bun run test:ui       # Vitest browser UI
bun run test:coverage # Coverage report
```

## Project Structure

```
src/apps/
├── core/                  # Shared business logic
│   ├── index.ts           # Public API re-exports
│   ├── agent.ts           # AgentSession singleton factory
│   ├── apiKey.ts          # AuthStorage wrapper (API key persistence)
│   ├── modelDiscovery.ts  # ModelRegistry cache (zai, minimax-cn)
│   ├── logger.ts          # Consola → ~/.pi/agent/logs/codeagent.log
│   └── logViewer.ts       # PowerShell log viewer window [dev only]
│
├── cli/                   # Application entry
│   ├── index.tsx          # Entry: TTY check, flag parsing, bootstrap
│   │
│   ├── ink/               # Interactive TUI (Ink + React)
│   │   ├── App.tsx        # Root component — page routing
│   │   ├── AppController.ts
│   │   ├── useKeyboardShortcuts.ts  # Double-press exit
│   │   │
│   │   ├── pages/
│   │   │   ├── types.ts              # ChatMessage, ChatMessageBlock types
│   │   │   ├── init/InitPage.tsx    # Loading spinner
│   │   │   ├── welcome/WelcomePage.tsx
│   │   │   └── chat/ChatPage.tsx    # Main chat + agent binding
│   │   │
│   │   ├── components/
│   │   │   ├── inputs/              # Input + slash command palette
│   │   │   ├── modals/              # Ask/Confirm/Notice/SelectOne modals
│   │   │   └── chat/                # MessageList, MessageItem, ChatHeader
│   │   │
│   │   ├── store/
│   │   │   ├── chatStore.ts  # Unified session + message state (Zustand)
│   │   │   ├── uiStore.ts    # Page routing + UI state
│   │   │   └── schemas.ts    # Zod schemas (single source of truth)
│   │   │
│   │   └── hooks/
│   │       ├── useAgentEvents.ts     # Agent event subscription + throttle
│   │       ├── useModelConfig.ts     # Config flow state machine
│   │       └── useProviderConfig.ts  # Provider/model selection UI
│   │
│   └── json/               # JSON output mode
│       ├── JsonMode.ts     # Event → NDJSON mapper
│       ├── emitter.ts      # NDJSON stdout writer
│       └── flags.ts        # --json, --prompt, --session parser
│
docs/
├── specs/                  # Architecture specifications
└── archive/               # Legacy docs

tests/                     # Vitest tests
```

## Configuration

Provider API keys are configured **at runtime** via the `/model` command (no `.env` needed). Keys are persisted in `AuthStorage` at `~/.pi/agent/`.

For automated/CI environments, you can still use environment variables:

```bash
# Optional: pre-configure via environment (optional — /model inside TUI is preferred)
DEFAULT_PROVIDER=zai
ZAI_API_KEY=your_zhipu_key
MINIMAX_API_KEY=your_key
MINIMAX_API_BASE_URL=https://api.minimax.chat
```

```bash
# Advanced environment variables
CODEAGENT_SESSION_DB=~/.codeagent/sessions.db  # SQLite session path (auto: ~/.codeagent/)
NODE_ENV=production               # Disables log viewer and dev features
```

## Architecture Highlights

### Core + App Separation

`src/apps/core/` is the **only** layer that imports `pi-coding-agent`. All other layers (`ink/`, `json/`) go through `core/index.ts` re-exports. This keeps the dependency graph clean and makes testing easier.

### Unified Chat Store

Session state and message state live in a **single Zustand store** (`chatStore.ts`). This reflects the true business model — a Session contains Messages — and makes `clearAll()` atomic.

### Streaming Throttle

Agent streaming deltas (text/thinking) are buffered in a **150 ms throttle window** before flushing to the store. Prevents React re-render storms from high-frequency token updates while keeping latency under 200 ms.

### Modal Pattern

Each modal is a **self-contained component** with its own reducer + module-level `dispatch` ref. `show*()` functions dispatch to this ref. `ModalContainer` renders all four; no prop drilling.

### Zod Schema as Type Source

Store types are derived via `z.infer<>` from Zod schemas defined in `schemas.ts`. Runtime validation at action boundaries ensures consistency between TypeScript types and actual data shape.

## Session Storage

- **Storage root**: `~/.codeagent/`
- **API keys**: `~/.codeagent/auth.json`
- **Sessions**: `~/.codeagent/sessions/` (JSON) + `~/.codeagent/sessions.db` (SQLite)
- **Override**: `CODEAGENT_SESSION_DB=...`

## License

ISC
