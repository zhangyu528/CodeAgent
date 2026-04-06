# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Running
- **Development**: `npm run dev` - Run Ink CLI in development mode with hot reload
- **Build**: `npm run build` - Build the CLI to dist/apps/cli/index.js using Bun
- **Start**: `npm start` - Run the built CLI application
- **Global install**: `npm install -g` then use `codeagent` command

### Testing
No test suite is currently configured. The project structure indicates where tests should go:
- Unit tests would go in `tests/unit/`
- Integration tests would go in `tests/integration/`

## Architecture Overview

### Core Components
1. **Agent System** (`src/agent/`)
   - Singleton agent instance using `@mariozechner/pi-agent-core`
   - Multi-provider LLM support (OpenAI/Anthropic/Zhipu/Minimax)
   - Tools integration for file operations, shell commands, web browsing
   - Model resolver with environment-based configuration

2. **CLI Application** (`src/apps/cli/`)
   - Ink TUI (Terminal User Interface) implementation
   - Two main pages: Welcome Page and Chat Page
   - Structured message rendering with reasoning separation
   - Session management with SQLite persistence

### Key Features
- **Session Persistence**: SQLite storage at `~/.codeagent/sessions.db`
- **Slash Commands**: `/help`, `/model`, `/new`, `/history`, `/resume`
- **Human-in-the-Loop**: Sensitive operations require user confirmation
- **Web Tools**: Web search and page browsing capabilities
- **Memory Management**: Token-aware sliding window (~4000 tokens)

### Project Structure (Hexagonal Architecture)
```
src/
├── agent/                    # Agent core business logic
│   ├── agent.ts             # Agent singleton factory
│   ├── model.ts             # LLM model resolution
│   ├── tools/               # Execution tools
│   └── sessions.ts          # Session management
├── apps/cli/                 # Ink CLI interface
│   ├── index.tsx            # CLI entry point
│   └── ink/                 # Ink components
│       ├── ink_app.tsx      # Main Ink app
│       ├── components/      # UI components
│       └── hooks/           # React hooks
└── docs/                    # Documentation and roadmaps
```

### Environment Configuration
Copy `.env.example` to `.env` and configure:
- `DEFAULT_PROVIDER`: `zai` or `minimax`
- `{PROVIDER}_API_KEY`: API keys for configured providers
- Optional: `{PROVIDER}_MODEL`, `{PROVIDER}_BASE_URL`, `{PROVIDER}_API`

### Development Notes
- Uses Bun as runtime (package.json has "engines": { "bun": ">=1.3.0" })
- TypeScript configuration is implicit in build process
- No type declaration files (tsconfig.json missing but works via Bun)
- Git uses LF line endings (check .gitattributes)

### Current Status (from ROADMAP.md)
- ✅ N1: New kernel with Ink TUI integration complete
- ✅ N2: Multi-provider support with env config complete
- 🚧 N3: Session lifecycle and persistence in progress
- 📅 N4: Session storage abstraction planned

### Important Conventions
- Agent is a singleton, use `getAgent()` to access
- Tools are registered with the agent at startup
- UI adapter is fixed for session lifecycle
- Session data is runtime-owned and persists across restarts