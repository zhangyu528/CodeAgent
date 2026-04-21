# CodeAgent Architecture Specification

> Generated from source code analysis — April 2026

---

## 1. Overview

**CodeAgent** is an AI-powered terminal coding assistant built on top of `@mariozechner/pi-coding-agent`. It provides two operational modes:

- **Interactive TUI Mode** (default): Full-screen Ink-based terminal UI with modal dialogs, slash commands, and structured chat history.
- **JSON Mode** (`--json` flag): Non-interactive NDJSON output for shell piping and scripting.

The application is developed in TypeScript as an ES module, using Bun as the runtime and build tool.

---

## 2. High-Level Architecture

```
src/apps/
├── core/              # Shared business logic (auth, session, model registry, logging)
│   ├── index.ts       # Public API re-exports
│   ├── agent.ts       # AgentSession singleton factory
│   ├── apiKey.ts      # AuthStorage wrapper (API key persistence)
│   ├── modelDiscovery.ts  # ModelRegistry cache layer (zai, minimax-cn)
│   ├── logger.ts      # Consola-based logger → ~/.pi/agent/logs/codeagent.log
│   └── logViewer.ts   # PowerShell log viewer window management
│
├── cli/               # Main application entry
│   ├── index.tsx      # Entry point — TTY check, flag parsing, bootstrap
│   │
│   ├── ink/            # Interactive TUI (Ink + React)
│   │   ├── App.tsx                  # Root component (page routing)
│   │   ├── AppController.ts          # Page lifecycle + terminal resize
│   │   ├── useKeyboardShortcuts.ts   # Ctrl+C/Ctrl+D double-press exit
│   │   │
│   │   ├── pages/                    # Page components
│   │   │   ├── types.ts              # ChatMessage, ChatMessageBlock types
│   │   │   ├── init/InitPage.tsx     # Loading spinner during agent init
│   │   │   ├── welcome/WelcomePage.tsx  # Welcome logo + first-run detection
│   │   │   └── chat/ChatPage.tsx     # Main chat UI + agent event binding
│   │   │
│   │   ├── components/
│   │   │   ├── inputs/               # Text input + slash command palette
│   │   │   │   ├── input.tsx         # Input box with prompt/status bar
│   │   │   │   ├── InputController.ts  # Keyboard input handling + submission
│   │   │   │   ├── InputField.tsx    # Styled text field
│   │   │   │   ├── SlashList.tsx     # Command palette popup
│   │   │   │   ├── SlashListController.ts  # Slash filtering + execution
│   │   │   │   ├── useSlashCommands.ts    # Command registry + executeSlash()
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── modals/               # Self-contained modal dialogs
│   │   │   │   ├── ModalContainer.tsx   # Renders all modals
│   │   │   │   ├── ModalFrame.tsx       # Shared modal border/title/footer
│   │   │   │   ├── visibility.ts        # Modal visibility state tracking
│   │   │   │   ├── textLayout.ts        # padToWidth, wrapToWidth helpers
│   │   │   │   ├── AskModal.tsx         # Text input modal
│   │   │   │   ├── ConfirmModal.tsx     # Confirmation dialog
│   │   │   │   ├── NoticeModal.tsx      # Notice/information modal
│   │   │   │   └── SelectOneModal.tsx   # Single-selection list modal
│   │   │   │
│   │   │   ├── chat/                  # Chat message rendering
│   │   │   │   ├── ChatHeader.tsx     # Session title + token usage display
│   │   │   │   ├── MessageList.tsx    # Scrollable message list (ink-scroll-view)
│   │   │   │   ├── MessageItem.tsx    # Individual message with block rendering
│   │   │   │   ├── DateDivider.tsx    # "今天"/"昨天"/date date separators
│   │   │   │   ├── TypingIndicator.tsx  # "..." / "Generating..." animation
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── ErrorBoundary.tsx      # React error boundary wrapper
│   │   │
│   │   ├── store/                     # Zustand state stores
│   │   │   ├── index.ts               # Re-exports
│   │   │   ├── chatStore.ts           # Unified session + message state
│   │   │   ├── uiStore.ts             # Page routing + UI state
│   │   │   └── schemas.ts             # Zod schemas (source of truth for types)
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAgentEvents.ts      # AgentSession event subscription + throttling
│   │   │   ├── useModelConfig.ts      # Config flow state machine
│   │   │   ├── useProviderConfig.ts   # Provider/model selection UI helpers
│   │   │   ├── useTokenTracking.ts    # Token usage display logic
│   │   │   └── index.ts
│   │   │
│   │   └── utils/
│   │       ├── utils.ts               # shortenPath, getCurrentDateString
│   │       └── messageAdapters.ts     # agentMessagesToChatMessages converter
│   │
│   └── json/              # JSON output mode
│       ├── JsonMode.ts    # Agent event → JSON event mapper
│       ├── emitter.ts     # NDJSON stdout writer
│       ├── flags.ts       # CLI flag parser (--json, --prompt, --session)
│       ├── types.ts       # JsonEvent type definitions
│       └── index.ts
```

---

## 3. Core Layer (`src/apps/core/`)

### 3.1 Agent Singleton (`agent.ts`)

- **`ensureAgentInitialized()`**: Initializes `AgentSession` once, returns same Promise for concurrent calls.
- **`getAgentSession()`**: Synchronous access to the initialized singleton (throws if not initialized).
- Tools registered at startup: `codingTools` + `findTool` + `grepTool` + `lsTool` from `pi-coding-agent`.
- `cwd` is set to `process.cwd()` at initialization time.

### 3.2 API Key Management (`apiKey.ts`)

- Wraps `AuthStorage` from `pi-coding-agent` (lazy singleton).
- Config path via `PI_CODING_AGENT_DIR` env var (default: `~/.pi/agent`).
- **`checkApiKeyConfigured(provider)`**: Returns boolean.
- **`saveApiKey(provider, apiKey)`**: Validates (length ≥ 8, no control chars) before saving.
- **`removeApiKey(provider)`**: Removes from AuthStorage.
- **`isFirstRun()`**: Returns `true` only when no API keys configured AND no session files exist.

### 3.3 Model Discovery (`modelDiscovery.ts`)

- Wraps `ModelRegistry` from `pi-coding-agent` with an in-process cache.
- Only exposes models from allowed providers: **`zai`**, **`minimax-cn`**.
- `ensureProvidersLoaded()`: Blocking wait if cache is being populated by another call.
- `reloadProviders()`: Clears cache and re-discovers — used after saving a new API key.

### 3.4 Logging (`logger.ts`)

- Uses **Consola** with a custom file reporter.
- Log file: `~/.pi/agent/logs/codeagent.log` (daily rotation handled by filename).
- Dev mode (`NODE_ENV !== 'production'`): console + file.
- Prod mode: file only.
- Log level set to `Infinity` (all messages pass through).

### 3.5 Log Viewer (`logViewer.ts`)

- Dev-only: opens a detached PowerShell window that tails `codeagent.log`.
- Window PID saved to `~/.pi/agent/logs/logviewer.pid` for cleanup.
- `openLogViewer()`: spawns `cmd /c start Log Viewer powershell ...` with `-NoExit`.
- `closeLogViewer()`: kills the PowerShell process via `taskkill /PID`.

---

## 4. State Management

### 4.1 UI Store (`uiStore.ts`)

Single Zustand store for app-level UI state:

```typescript
{
  page: PiPage;
  isFirstPress: boolean;
  currentModel: string | null;
  pendingPrompt: string | null;
  hasModalOpen: boolean;
}
```

- `PiPage` = `'init' | 'welcome' | 'chat'`
- `isFirstPress`: Tracks first Ctrl+C press for double-press exit hint.

### 4.2 Chat Store (`chatStore.ts`)

Unified store combining session state and message state (single aggregate):

```typescript
{
  // Session
  historyItems: SessionInfo[];
  currentSession: ChatSessionInfo | null;
  activeSessionId: string | null;
  pendingPrompt: string | null;

  // Messages
  messages: ChatMessage[];
  thinking: boolean;
  usage: { input, output, cost } | null;
}
```

Key behaviors:

- **`refreshHistory()`**: Calls `SessionManager.list(cwd)` to enumerate saved sessions.
- **`restoreSessionById(id)`**: Calls `session.switchSession(id)` and hydrates store from `session.messages`.
- **`ensureSessionForPrompt(text)`**: Creates new session or reuses active one; derives title from first 40 chars.
- **`persistCurrentSession()`**: Debounced (500 ms) local state update. Calls `session.setSessionName(title)` on first message.
- **`clearAll()`**: Calls `session.newSession()` and resets all state atomically.
- **Pending prompt flow**: WelcomePage stores the first prompt as `pendingPrompt` → ChatPage mounts → reads and clears it → sends to agent.

### 4.3 Schemas (`schemas.ts`)

Zod schemas as the **single source of truth** for types. Types are derived via `z.infer<>`:

- `ChatMessageBlockSchema`: discriminated union — `text | thinking | reasoning | toolSummary`
- `ChatMessageSchema`: id, role, title, createdAt, status, blocks[]
- `ChatSessionInfoSchema`: id, title, status, updatedAt, messageCount
- `MessageStoreStateSchema`: messages[], thinking, usage
- `ChatMessagePartialSchema`: partial for update operations

---

## 5. Data Flow

### 5.1 App Initialization

```
bootstrap()
  → openLogViewer()          [dev only]
  → ensureAgentInitialized() → createAgentSession() → AgentSession singleton
  → render(<App>, {initPromise})
    → AppController mounts
    → page='init' → InitPage shown
    → initPromise resolves → setPage('welcome') → WelcomePage shown
```

### 5.2 Prompt Flow (Welcome → Chat)

```
User types prompt + Enter on WelcomePage
  → InputController.submitPrompt()
    → useChatStore.ensureSessionForPrompt()  [creates session metadata]
    → useChatStore.setPendingPrompt()         [stores for ChatPage]
    → useAppStore.setPage('chat')
  → ChatPage mounts (useEffect, runs once)
    → useChatStore.getAndClearPendingPrompt()  [reads + clears]
    → useChatStore.ensureSessionForPrompt()    [re-confirms session]
    → useChatStore.addMessage()               [user message]
    → session.prompt(pendingPrompt)           [sends to agent]
```

### 5.3 Agent Event → UI Update

```
AgentSession emits event
  → useAgentEvents subscription (in ChatPage)
    → 'agent_start': add empty assistant message, setThinking(true)
    → 'message_update': append text_delta / thinking_delta to throttle buffer
    → 'message_end': flush deltas, setUsage, update last message status
    → 'agent_end': flushDeltas(), stopThrottle(), onTurnSettled()
      → persistCurrentSession() [debounced 500ms]
```

### 5.4 Streaming Throttle

- Text and thinking deltas are buffered in a 150 ms interval window.
- `flushDeltas()` is called on interval tick OR when `agent_end` fires.
- Prevents React re-render storms from high-frequency token updates.

---

## 6. Slash Commands

Registered commands (`useSlashCommands.ts`):

| Command    | Handler                                      | Description             |
| ---------- | -------------------------------------------- | ----------------------- |
| `/help`    | `showNotice(HELP_MESSAGE)`                   | Show command list       |
| `/new`     | `clearAll()` + `setPage('welcome')`          | New session             |
| `/model`   | `modelConfig.startConfig()`                  | Open model picker       |
| `/history` | `openHistoryModal()`                         | Browse/restore sessions |
| `/resume`  | `refreshHistory(1)` + `restoreSessionById()` | Resume last session     |
| `/quit`    | `exit()`                                     | Exit app                |

Prefix matching: `/h` matches `/help`, `/hi` matches `/history`, etc. (longest match wins).

---

## 7. Modal System

Four self-contained modals managed via reducer + global ref pattern:

- **`AskModal`**: Text input — `showAsk({title, message, onSubmit, onCancel})`
- **`ConfirmModal`**: Yes/No confirmation — `showConfirm({title, message, onSubmit, onCancel})`
- **`NoticeModal`**: Informational OK dialog — `showNotice({title, message, footer})`
- **`SelectOneModal`**: Single-selection list — `showSelectOne({title, choices, onSubmit, onCancel})`

Each modal has a module-level `dispatch` ref set in its `useEffect`. The `show*` functions dispatch to this ref. `ModalContainer` renders all four; visibility is controlled by the reducer state.

`visibility.ts` tracks which modal is open (`notice | confirm | ask | selectOne | null`) via `modalVisibility` singleton for use by `useModalOpenState()`.

---

## 8. JSON Mode (`--json`)

Activated by `--json` CLI flag. Skips TTY requirement.

```
runJsonMode(flags)
  → ensureAgentInitialized()
  → initJsonMode()  [sets emitter to NDJSON mode]
  → session.subscribe(handleAgentEvent)
    → 'message_end': emits {type: 'response', content, model}
    → 'message_update': emits {type: 'response', content: delta} for text_delta
  → if --session: restoreSessionById()
  → if --prompt: session.prompt(prompt)
```

Emitted events are written to stdout as NDJSON lines.

---

## 9. Keyboard Interactions

### Input Component

- `Enter` / `Return`: Submit prompt or execute slash command.
- `Backspace` / `Delete`: Delete last character.
- `Escape`: Clear input field.
- Character keys: Append to input (when no modal is open).
- Slash (`/`) at start: Shows command palette (does not hijack — still appears in input field).

### Message List

- `↑` / `↓`: Scroll by 1/3 viewport.
- `PageUp` / `PageDown`: Scroll by full viewport.
- Mouse wheel (xterm sequences): Same as arrow keys.
- Auto-pinned to bottom; unpins on manual scroll up; shows unread indicator.

### Exit Flow

- `Ctrl+C` or `Ctrl+D`: First press shows 2-second hint banner "再按一次 Ctrl+C 或 Ctrl+D 退出". Second press within 2s exits.

---

## 10. Testing

Test runner: **Vitest** with `@vitest/ui` for browser-based test UI.

Test files (`tests/`):

| Path                       | Type        | Description                                                                                                                                                                                                 |
| -------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unit/apps/cli/json/`      | Unit        | flags, emitter, types, CLI output                                                                                                                                                                           |
| `unit/apps/cli/ink/store/` | Unit        | chatStore, schemas                                                                                                                                                                                          |
| `unit/`                    | Unit        | useAgentEvents throttle, useSlashCommands, useModelConfig, uiStore, inputLogic, textLayout, modalReducers, visibility, utils, types                                                                         |
| `components/`              | Component   | AskModal, ChatHeader, ConfirmModal, DateDivider, ErrorBoundary, Input, InputField, MessageList, ModalContainer, ModalFrame, NoticeModal, PromptBox, SelectOneModal, SlashList, TypingIndicator, WelcomePage |
| `pages/init/`              | Page        | InitPage                                                                                                                                                                                                    |
| `integration/`             | Integration | modelSelectionComplete, modelSelectionFlow                                                                                                                                                                  |

Notable test infrastructure:

- `ink-testing-library` for rendering Ink components.
- `vi.useFakeTimers()` + `vi.advanceTimersByTime()` for throttle interval tests.

---

## 11. Dependencies

| Package                         | Version | Role                                  |
| ------------------------------- | ------- | ------------------------------------- |
| `@mariozechner/pi-coding-agent` | ^0.61.1 | Core agent, session management, tools |
| `ink`                           | ^6.8.0  | TUI rendering framework               |
| `react`                         | ^19.0.0 | UI library                            |
| `zustand`                       | ^5.0.12 | State management                      |
| `zod`                           | ^4.3.6  | Schema validation                     |
| `ink-scroll-view`               | ^0.3.6  | Scrollable view for messages          |
| `@byteland/ink-scroll-bar`      | ^1.0.0  | Scroll bar                            |
| `consola`                       | ^3.4.2  | Logging                               |
| `vitest`                        | ^4.1.2  | Test runner                           |
| `husky`                         | ^9.1.7  | Git hooks                             |

---

## 12. Configuration & Environment

- **Storage path**: All persistent data lives under `~/.codeagent/`:
  - `~/.codeagent/auth.json` — API keys (via AuthStorage)
  - `~/.codeagent/sessions/` — Session files (JSON)
  - `~/.codeagent/logs/codeagent.log` — Application log
  - `~/.codeagent/logs/logviewer.pid` — Log viewer process ID [dev only]
- **`CODEAGENT_SESSION_DB`**: Override session SQLite path (default: `~/.codeagent/sessions.db`).
- Bun runtime (`bun:sqlite`) with `node:sqlite` fallback for session persistence.
- Allowed model providers: `zai`, `minimax-cn`.
