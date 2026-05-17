# CodeAgent Electron App — APP_MAP

> Generated: 2026/05/11
> Based on: `src/apps/electron/`, `src/backend/`

---

# App Overview

**Type**: Desktop AI Coding Assistant (Electron)

**Core Function**: An AI pair programmer that lets users chat with an LLM agent about their codebase, with multi-project support, session management, and coding tool execution (bash, find, grep, ls).

**Tech Stack**:

- **Main Process**: Node.js (Electron main + IPC handlers)
- **Renderer**: Vanilla JS + HTML/CSS (no React/framework)
- **Agent Engine**: `@mariozechner/pi-coding-agent` (AgentSession, codingTools)
- **State**: Zustand (CLI only); Electron renderer uses module-level variables
- **Persistence**: JSON files (`projects.json`, session `.jsonl` files, `settings.json`)

**Data Directory**: `~/.pi/agent/` (via `getAgentDir()`)

```
~/.pi/agent/
├── projects.json        # Registered projects list
├── sessions/
│   ├── __global__/      # Global sessions (no project)
│   └── --{path}--/       # Per-project sessions (path encoded)
├── settings.json        # Model preferences
└── auth.json            # API keys (encrypted)
```

---

# Features

## Core Features

| Feature                     | Status | Notes                                                                  |
| --------------------------- | ------ | ---------------------------------------------------------------------- |
| Multi-project management    | ✅     | Projects registered in `projects.json`, each with independent sessions |
| Session management          | ✅     | Create, switch, rename, delete, export (HTML/JSONL)                    |
| AI chat with streaming      | ✅     | Real-time token streaming via `agent:event` IPC                        |
| Tool execution              | ✅     | Bash, Find, Grep, Ls tools via pi-coding-agent                         |
| Context usage tracking      | ✅     | Token count + context window bar in status bar                         |
| Auto-compaction             | ✅     | Automatic context summarization when memory is high                    |
| Manual compact              | ✅     | User-triggered compaction via floating button                          |
| Thinking levels             | ✅     | none/minimal/low/medium/high/xhigh, cycleable via status bar           |
| Model selection             | ✅     | Provider (zai, minimax-cn) + model picker in settings                  |
| API key management          | ✅     | Per-provider API key storage                                           |
| Project breadcrumb switcher | ✅     | Click breadcrumb → dropdown project switcher                           |
| Session export              | ✅     | HTML (chat-style) and JSONL formats                                    |
| Keyboard navigation         | ✅     | Arrow keys + Enter in session list, Ctrl+E expand                      |
| First-run wizard            | ✅     | Auto-opens settings if no model configured                             |

## Planned / Partial Features

| Feature        | Status | Notes                   |
| -------------- | ------ | ----------------------- |
| Session search | ❌     | Not implemented         |
| Message search | ❌     | Not implemented         |
| Undo/redo      | ❌     | Not implemented         |
| Multi-window   | ❌     | Single window only      |
| Notifications  | ❌     | No system notifications |
| Theme toggle   | ❌     | Dark only               |

---

# Routes

**No URL routing** — this is a single-page desktop app. All navigation is in-memory via DOM manipulation.

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ [Activity Bar] │ [Sidebar]           │ [Main Area]          │
│   48px fixed   │   240px collapsible │   flex: 1            │
│                │                     │                      │
│   ☰ (sidebar)  │ [PROJECTS header]   │ [Breadcrumb Bar]    │
│                │                     │ [Welcome Card]       │
│   [spacer]     │ [Project Groups]    │   or                │
│                │   └ Session Items   │ [Message List]      │
│                │                     │                      │
│                │ [+ New Project]     │ [Input Area]         │
│                │                     │ [Status Bar]         │
└─────────────────────────────────────────────────────────────┘
```

### Activity Bar (48px)

- Toggle sidebar button (`#ab-sidebar`)

### Sidebar (240px, collapsible)

- Projects section header
- Project groups (accordion, one expanded at a time)
  - Project header (click to activate project)
  - Session items (click to switch session)
  - Empty state hint ("在输入框中提问即可开始")
- "+ 新项目" button → opens directory picker

### Main Area

- **Breadcrumb bar** (shown when session active): `ProjectName › SessionName`
  - Click → opens project switcher dropdown
- **Welcome card** (when no messages): Tips with clickable examples
- **Message list**: Scrollable, grouped by role (user/assistant/tool/error)
- **Input area**: Auto-expanding textarea, send/abort buttons
- **Status bar**: Ready/Thinking…/Error | Model | Thinking Level | Context bar

### Floating Elements

- **Compact button**: Bottom-right, shown when context ≥80%
- **Settings modal**: Centered overlay with provider/model/API key configuration
- **Stats popup**: Click context bar → session stats overlay
- **Context menus**: Right-click on sessions or project headers
- **Project switcher dropdown**: From breadcrumb

---

# User Flows

## Flow 1: First Launch

```
1. App starts → window opens
2. init IPC → ensureAgentInitialized()
3. Check isFirstRun() or currentModel
4. → Auto-open Settings modal (no model configured)
5. User selects provider → enters API key → selects model
6. User closes settings → Ready state
```

## Flow 2: New Project + First Chat

```
1. User clicks "+ 新项目" in sidebar
2. Electron directory picker opens
3. User selects a project directory
4. activateProject() → project registered in projects.json
5. Sidebar updates → new project group appears (expanded)
6. User types in input → on Enter:
   a. No active session → newSessionForProject() or newGlobalSession()
   b. Session file created lazily (first prompt)
   c. prompt() sends message to agent
   d. Streaming events update UI in real-time
   e. Message appears in list
7. Session saved to session file on each turn
```

## Flow 3: Switch Project

```
1. User clicks breadcrumb → project switcher dropdown appears
2. User clicks different project (or Global)
3. If streaming → confirm dialog
4. activateProject(newPath)
5. currentSessionId = null, messages cleared
6. Show welcome card
7. Next prompt creates new session for that project
```

## Flow 4: Switch Session

```
1. User clicks session item in sidebar
2. switchSession(sessionPath, projectCwd)
3. AgentSession.switchSession() loads session file
4. loadMessages() renders chat history
5. Sidebar updates active state
```

## Flow 5: Compact Context

```
1. Context usage reaches 80% → compact button appears
2. User clicks "Compact" OR auto-compaction triggers
3. compact() → AgentSession.compact()
4. UI shows "Auto-compacting..." status
5. On completion: summary message appended to chat
6. Context bar updates with new token count
```

## Flow 6: Change Thinking Level

```
1. User clicks thinking level in status bar (e.g., "TH:M")
2. cycleThinkingLevel() → session.setThinkingLevel()
3. Display updates with new color-coded level
```

## Flow 7: Export Session

```
1. Right-click session → context menu
2. Export HTML / Export JSONL
3. exportSession() → session.exportToHtml() or exportToJsonl()
4. File saved to session's directory
5. Status toast shown
```

---

# Components

## UI Components (renderer, vanilla JS)

### Message Components

| Component              | File              | Description                                       |
| ---------------------- | ----------------- | ------------------------------------------------- |
| Message card           | `app.js` (inline) | `.msg` div with role label + content blocks       |
| Text block             | `renderBlock()`   | Plain text, rendered as `document.createTextNode` |
| Image block            | `renderBlock()`   | `<img>` with max-width constraint                 |
| Reasoning block        | `renderBlock()`   | Collapsible, shows thinking steps + tool calls    |
| Tool result block      | `renderBlock()`   | One-liner with expand toggle for full output      |
| Tool call in reasoning | inline            | Icon + name + args, expandable result             |

### Layout Components

| Component     | Element               | Description                                         |
| ------------- | --------------------- | --------------------------------------------------- |
| Activity Bar  | `#activity-bar`       | 48px left sidebar with toggle button                |
| Sidebar       | `#sidebar`            | 240px collapsible, contains session list            |
| Session List  | `#session-list`       | Grouped by project                                  |
| Project Group | `.proj-group`         | Accordion per project                               |
| Session Item  | `.session-item`       | Clickable, shows name + hover actions               |
| Main Area     | `#main`               | Flex column: breadcrumb + messages + input + status |
| Breadcrumb    | `#project-breadcrumb` | Shows `ProjectName › SessionName`                   |
| Input Area    | `#input-area`         | Textarea + send/abort buttons                       |
| Status Bar    | `#status`             | Fixed bottom bar with model/ctx/thinking            |

### Modal/Popup Components

| Component              | Description                                                     |
| ---------------------- | --------------------------------------------------------------- |
| Settings Overlay       | Provider/model/API key config with 3 steps                      |
| Stats Popup            | Token counts, message counts, cost — triggered by ctx bar click |
| Project Switcher       | Dropdown from breadcrumb, lists all projects                    |
| Confirm Dialog         | Native `window.confirm` for streaming switch                    |
| Context Menu (session) | Rename, Copy ID, Export HTML/JSONL, Delete                      |
| Context Menu (project) | Rename Project, Delete Project                                  |

### Block Renderers (`app.js`)

```javascript
renderBlock(block) → DOM element
  ├── kind === "text"       → TextNode
  ├── kind === "image"       → <img>
  ├── kind === "reasoning"  → Collapsible reasoning block
  ├── kind === "toolResult"  → Expandable tool result one-liner
  └── kind === "collapsible" → Generic collapsible block
```

---

# State Management

## Renderer State (app.js — module-level variables)

```javascript
let currentSessionId = null; // Active session ID
let currentProjectPath = null; // Active project path
let isStreaming = false; // Agent is generating response
let pendingEl = null; // DOM element for streaming message
let currentModelId = null; // Current model ID string
let settingsStep = 'idle'; // Settings modal step: idle|apikey|model
let selectedProvider = null; // Selected provider in settings
let expandedSessionId = null; // Ctrl+E expanded session
let ctxMenuTarget = null; // Right-clicked session
let projCtxMenuTarget = null; // Right-clicked project
window._cachedSessions = []; // Cached session list (shared with project switcher)
let kbSelectedIndex = -1; // Keyboard navigation index
```

## Backend State (pool.ts — module-level)

```javascript
const _pool = new Map<string, PooledSession>();  // projectCwd → session
let _activeProjectPath: string | null = null;     // Currently active project
let _activeSessionFile: string | null = null;      // Active session file path
let _initialized = false;
let _initPromise: Promise<void> | null = null;
```

## Project/Session Metadata (registry.ts + manager.ts)

```javascript
// projects.json on disk
{
  projects: [{ path, name, createdAt }];
}

// Session files: JSONL per turn
// Header line: { id, type: "session", version, timestamp, name, cwd }
// Per-message: { type, message: { role, blocks/content, ... }, ... }
```

## No Formal State Library

The Electron renderer uses **no Zustand, no Redux, no Context API** — just plain JS module variables. State is not reactive; UI updates are imperative via direct DOM manipulation.

---

# API Layer

## IPC Channel Map (main.ts ↔ preload.ts)

All IPC handlers live in `ipcMain.handle()` in main.ts.

### Agent Core

| Channel                  | Direction | Description                                       |
| ------------------------ | --------- | ------------------------------------------------- |
| `agent:init`             | →         | Bootstrap agent, return existing sessionId        |
| `agent:prompt`           | →         | Send prompt, subscribe to events                  |
| `agent:getMessages`      | →         | Get all messages for current session              |
| `agent:getSessionId`     | →         | Get current session ID                            |
| `agent:hasActiveSession` | →         | Check if session is active                        |
| `agent:onEvent`          | ←         | Subscribe to streaming events (via `agent:event`) |

### Session Management

| Channel                      | Description                             |
| ---------------------------- | --------------------------------------- |
| `agent:listSessions`         | List all sessions (across all projects) |
| `agent:switchSession`        | Switch to a specific session file       |
| `agent:newSession`           | Create new session for active project   |
| `agent:newGlobalSession`     | Create new global session (no project)  |
| `agent:newSessionForProject` | Create new session in specific project  |
| `agent:renameSession`        | Rename session (updates header)         |
| `agent:deleteSession`        | Delete session file                     |
| `agent:exportSession`        | Export session to HTML or JSONL         |

### Project Management

| Channel                      | Description                                 |
| ---------------------------- | ------------------------------------------- |
| `agent:listProjects`         | List all registered projects                |
| `agent:activateProject`      | Set active project (no session created yet) |
| `agent:deleteProject`        | Unregister project (keep sessions)          |
| `agent:renameProject`        | Rename project display name                 |
| `agent:selectDirectory`      | Open native directory picker                |
| `agent:newSessionForProject` | Create session for project + activate       |
| `agent:getCurrentCwd`        | Get active project path                     |

### Model & Config

| Channel                 | Description                               |
| ----------------------- | ----------------------------------------- |
| `agent:getConfig`       | Get providers list + current model        |
| `agent:getProviders`    | Get all providers with hasApiKey flag     |
| `agent:getModels`       | Get models for a provider                 |
| `agent:setModel`        | Set active model                          |
| `agent:saveApiKey`      | Save API key for provider                 |
| `agent:removeApiKey`    | Remove API key                            |
| `agent:isFirstRun`      | Check if first launch                     |
| `agent:reloadProviders` | Reload provider list after API key change |

### Context & Compaction

| Channel                   | Description                                  |
| ------------------------- | -------------------------------------------- |
| `agent:getContextUsage`   | Get token count, context window, percentage  |
| `agent:compact`           | Manual compaction with optional instructions |
| `agent:setAutoCompaction` | Enable/disable auto-compaction               |
| `agent:getAutoCompaction` | Check auto-compaction enabled state          |
| `agent:isCompacting`      | Check if compaction is in progress           |

### Session Stats & Thinking

| Channel                    | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| `agent:getSessionStats`    | Get user/assistant/tool message counts + token counts + cost |
| `agent:getThinkingLevel`   | Get current thinking level + available levels                |
| `agent:setThinkingLevel`   | Set thinking level                                           |
| `agent:cycleThinkingLevel` | Cycle to next thinking level                                 |

### Utilities

| Channel               | Description                       |
| --------------------- | --------------------------------- |
| `agent:abort`         | Abort current streaming response  |
| `agent:getAgentHome`  | Get `~/.pi/agent` path            |
| `agent:debugReadFile` | Debug: read session file contents |
| `shell:openExternal`  | Open URL in system browser        |

## AgentEvent Types (streaming)

Events flow from main process to renderer via `mainWindow.webContents.send('agent:event', evt)`:

| Event Type              | Payload                                 | UI Action                          |
| ----------------------- | --------------------------------------- | ---------------------------------- |
| `agent_start`           | `{}`                                    | Show abort button, clear input     |
| `message_update`        | `assistantMessageEvent`                 | Update streaming message blocks    |
| `agent_end`             | `{}`                                    | Finalize message, hide abort       |
| `auto_compaction_start` | `{}`                                    | Show compacting status             |
| `auto_compaction_end`   | `{summary, aborted}`                    | Update ctx bar, append summary msg |
| `tool_execution_start`  | `{toolName}`                            | Mark tool as running in reasoning  |
| `tool_execution_end`    | `{toolName, result, isError}`           | Update tool result in reasoning    |
| `message_end`           | `{message: {stopReason, errorMessage}}` | Handle errors                      |
| `turn_start`            | `{}`                                    | Set status "Thinking…"             |
| `message_start`         | `{message: {role}}`                     | Set status "Generating…"           |
| `auto_retry_start`      | `{attempt, maxAttempts, errorMessage}`  | Show retry message                 |
| `auto_retry_end`        | `{success, finalError}`                 | Handle retry failure               |

---

# Data Flow

```
User Input
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  renderer/app.js                                         │
│  sendMessage() → window.agent.prompt(text)               │
└───────────────────────┬─────────────────────────────────┘
                        │ IPC: 'agent:prompt'
                        ▼
┌─────────────────────────────────────────────────────────┐
│  electron/main.ts                                        │
│  ipcMain.handle('agent:prompt')                          │
│    ├── subscribeToActiveSession(cb)  ← registers event cb │
│    ├── prompt(promptText)                                 │
│    │   └── pooled.session.prompt()                       │
│    │       └── pi-coding-agent: AgentSession.prompt()    │
│    │           └── LLM API call                          │
│    │           └── streams events → callback             │
│    └── callback → webContents.send('agent:event', evt)  │
└───────────────────────┬─────────────────────────────────┘
                        │ IPC: 'agent:event'
                        ▼
┌─────────────────────────────────────────────────────────┐
│  renderer/app.js                                         │
│  window.agent.onEvent(handleAgentEvent)                   │
│    └── handleAgentEvent(evt) → update DOM imperatively  │
└─────────────────────────────────────────────────────────┘
```

### Startup Data Flow

```
App Launch
    │
    ▼
main.ts: app.whenReady() → createWindow()
    │
    ▼
renderer/app.js: init()
    │
    ├── window.agent.init()           → ensureAgentInitialized()
    ├── window.agent.getConfig()      → getProviders() + currentModel
    ├── window.agent.isFirstRun()     → check
    ├── window.agent.listProjects()   → loadProjects()
    ├── window.agent.listSessions()  → loadSessions()
    ├── window.agent.getMessages()   → loadMessages()
    ├── window.agent.getContextUsage()→ updateContextBar()
    ├── window.agent.getThinkingLevel()→ updateThinkingLevelDisplay()
    └── window.agent.onEvent(handleAgentEvent)
```

---

# Architecture Notes

## Lazy Session Creation

Sessions are **never** created when a project is added or when a user selects a project. The session file is created only on the **first prompt**. This means:

- `activateProject()` → no session file
- First `prompt()` → `ensureActiveSession()` → `getOrCreateSessionForProject()` → session file created

## Session Pool

One `AgentSession` per project is kept in `_pool` Map. Switching projects loads/creates that project's session. This means **only one project is "active" at a time** in terms of the agent's tool bindings (cwd, etc.).

## No Formal Permissions System

There is no user authentication, authorization, or multi-user support. All sessions are local to the machine.

## Two-Provider Model

The model registry supports two providers: `zai` and `minimax-cn`. API keys are stored in `auth.json`. Model selection is persisted in `settings.json` as `defaultProvider` + `defaultModel`.

---

# Current UX Problems

Based on code analysis, the following UX issues are observed:

## High Priority

1. **No session search** — With many sessions, finding a specific one requires scrolling. No Ctrl+F equivalent for sessions.

2. **No message search** — Cannot search within chat history. No Ctrl+F within messages.

3. **Keyboard shortcuts not discoverable** — Arrow navigation and Ctrl+E exist but no help overlay. Users don't know they exist.

4. **Settings modal is tedious** — Three-step flow (provider → API key → model) requires multiple clicks. First-run could be streamlined.

5. **Welcome card tips are hardcoded** — The two example prompts in `#welcome-tips` cannot be customized.

6. **No empty state illustration** — The empty project state ("在输入框中提问即可开始") is plain text. No visual indicator of what to do.

7. **No loading state for session switch** — `switchSession()` is async but no loading spinner shown while chat history loads.

## Medium Priority

8. **No undo for delete operations** — Session and project deletions are immediate and irreversible. No trash/undo.

9. **Context menu plain styling** — Right-click menus use basic `div` styling. No icons, no keyboard navigation within menus.

10. **No notification on export complete** — Export saves to disk silently. No system notification or in-app toast with the file path.

11. **Compact button overlaps other UI** — Fixed position at `bottom:72px; right:28px`. May overlap content on smaller windows.

12. **No theme support** — Dark theme only. No light mode option.

13. **Stats popup auto-dismisses after 2.5s** — `showStatus()` timer is too short to read all stats. Should be persistent or manually dismissible.

14. **No confirmation before deleting active session** — `ctx-delete` shows a confirm dialog only for deletion, but switching away from a session has no warning about losing unsaved streaming output.

## Low Priority

15. **Session rename is inline edit** — Replaces the entire session item with an `<input>`. No cancel button visible. Blur = save, but Escape = reload (correct).

16. **Project names derived from path** — If path is `/Users/john/very-long-project-name-2024`, name is that full string unless renamed.

17. **Global sessions shown separately** — `(未注册项目)` label for sessions whose project path no longer matches a registered project. Confusing label.

18. **No visual indicator of streaming** — The `· streaming…` label on the role element updates immediately, but there's no pulsing animation or other indicator.

19. **`isWSL` flag permanently modifies command line** — `app.commandLine.appendSwitch` runs at import time, affects all windows even on non-WSL platforms.

20. **Error messages not user-friendly** — Many errors propagate as raw `String(err)` which may include stack traces or internal paths.

---

# Redesign Suggestions

These are non-binding ideas for future AI-powered redesign work:

1. **Command palette (Ctrl+K)** — Unified search for sessions, projects, and messages. Also serves as shortcuts hub.

2. **Tab-based multi-session** — Each session as a tab, multiple sessions visible simultaneously, like VS Code.

3. **Chat message actions** — Copy message, regenerate, edit previous user message, branch conversation.

4. **Improved onboarding** — Interactive walkthrough for first launch explaining project concept, session model, and keyboard shortcuts.

5. **Context menu redesign** — Action-focused context menu with icons, keyboard navigation, grouped actions (session vs. project).

6. **Stats panel** — Persistent stats sidebar or docked panel with live token counting and cost tracking.

7. **Compact mode UI** — When context is high, subtle visual indicator (amber border) instead of floating button.

8. **Theme system** — CSS variable-based theming with dark (default), light, and high-contrast options.

9. **Session preview on hover** — Hovering a session item shows a preview tooltip of the last message or conversation summary.

10. **Project-level settings** — Per-project model selection, custom instructions, or system prompt overrides.

11. **Notification integration** — System notifications when agent completes long-running task while window is unfocused.

12. **Keyboard shortcuts help overlay** — Press `?` or `Ctrl+/` to show overlay listing all shortcuts.

13. **Auto-save indicator** — Show "Saved" / "Saving…" status in status bar after each turn.

14. **Breadcrumb improvement** — Show project path on hover, click segments to navigate to parent/session level.

15. **Streaming output for tool results** — Show bash output streaming in real-time, not just final result.

---

# File Map

```
src/apps/electron/
├── main.ts              # Electron main process + IPC handlers
├── preload.ts           # contextBridge API exposure
├── dev.ts               # Dev server launcher (esbuild + static server)
└── renderer/
    ├── index.html       # Single HTML file with all CSS + layout structure
    └── app.js           # All renderer JS (vanilla, ~1700 lines)

src/backend/
├── index.ts             # Re-exports all backend modules
├── logger.ts            # Winston logger instance
├── auth/
│   ├── index.ts         # saveApiKey, removeApiKey, checkApiKeyConfigured
│   └── storage.ts       # AuthStorage class (reads/writes auth.json)
├── model/
│   ├── index.ts         # getSettingsManager, getModelRegistry
│   ├── registry.ts     # Provider/model loading + caching
│   └── settings.ts     # SettingsManager (reads/writes settings.json)
├── project/
│   ├── index.ts         # listProjects, addProject, removeProject, renameProject
│   └── registry.ts     # projects.json persistence
└── session/
    ├── index.ts         # Public API re-exports
    ├── manager.ts       # SessionManager wrapper (listSessions)
    └── pool.ts          # Session pool, lazy creation, all session ops

src/apps/cli/            # Separate CLI app (Ink-based React TUI)
src/apps/cli/escape/     # Escape mode TUI (React components)
```
