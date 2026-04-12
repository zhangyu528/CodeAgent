# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-12

### Features

- **cli**: Implement token tracking and add sessions error handling tests
- **cli**: Add ErrorBoundary, tools tests, and refactor useModelConfig
- **cli**: Add ESLint/Prettier config, GitHub Actions CI/CD, and agent unit tests
- **ink**: Add built-in free GLM provider for zero-config experience
- **ink**: Implement scrollable chat viewport with ink-scroll-view
- **cli**: Add structured chat timeline
- **ink**: Startup performance optimization + UI enhancement
- **ink**: Integrate DebugPanel and optimize message handling - add ChatPage input props, message save debounce, Ctrl+P debug panel
- **ink**: Improve chat UI with thinking/reasoning states and generating animation
- **provider**: Support `{PROVIDER}_API` and `{PROVIDER}_BASE_URL` env config
- **cli**: Migrate UI to Ink (React-based) and implement persistent session service
- **cli**: Refine Ink welcome banner and floating UI components
- **cli**: Unify InputBar style to round/cyan for consistency
- **cli**: Unify list styles and fix overlay positioning with inline push layout
- **cli**: Comprehensive enhancement of slash command interaction
- **cli**: Implement stable non-blocking vertical slash hints using surgical rendering
- **cli**: Optimize TTY keybindings (Ctrl+C to exit, ESC to clear/interrupt, F9 to toggle HUD)
- **cli**: Enhance input area with structured prompt and separator
- **cli**: Interactive model and provider selection with dynamic listing
- **cli**: Implement interactive initialization wizard with connectivity check
- **cli**: Improve CLI UX (/help, status HUD, keybindings)
- **cli**: Complete blessed TUI phase 2 with centered welcome layout and global Ctrl+D support
- **cli**: Integrate blessed for welcome screen with input
- **tui**: Add structured chat timeline
- **core**: Implement F5 browser search plan
- **core**: Implement F5 browse web tools
- **core**: Implement F4 multi-provider plan
- **core**: Add auto context boot snapshot
- **core**: Implement codebase search tools (F1) and update documentation
- **core**: Implement workspace authorization (F6) and finalize test suite reorganization
- **core**: Implement P3 usability module and refine core stability
- **core**: Implement P2 stability module with memory management and security layer
- **core**: Implement P1 execution ability module including planner and advanced tools
- **core**: Implement prompt templates and refine agent loop
- **core**: Implement GLM provider, test runner, and echo tool
- **core**: Initialize P0 core foundation module and project structure

### Bug Fixes

- **ui**: Fix hasAnyModalOpen reads directly from modalVisibility
- **session**: Fix clearSession now properly clears messageStore
- **post-commit**: Fix post-commit hook JSON escaping for Feishu
- **cli**: Fix resolve modal keyboard input issue when selecting model
- **session**: Fix sync messageStore when restoring session from history
- **ink**: Fix improve auto-scroll behavior for chat messages
- **cli**: Fix unify session restore UI state
- **cli**: Fix HUD disappearing on input/deletion and enhance rendering stability
- **cli**: Fix add missing readline import and refine interactive slash menu logic

### Refactoring

- **ui**: Unify modal styling with input/slashlist
- **ui**: Refine input styles, layouts, and interaction
- **cli**: Overhaul chat interface with seamless dark-mode command tower
- **ink**: Four-stage code refactoring - component splitting, Hooks extraction, message system fixes, test framework establishment
- **ink**: Four-stage refactoring - split components, Reducer and extract Hooks
- **MessageCard**: Optimize style structure - move background color to independent Box and adjust padding
- **tui**: Clarify modal routing and naming
- **cli**: Polish history modal and docs
- **cli**: Stabilize session flow and input handling
- **ink**: Reorganize components by domain and split UI types
- **cli**: Streamline PiInkApp state flow and model config UX
- **cli**: Switch to tsx and optimize Ink UI popups and interaction. Fixed ESM load crashes on Node.js 23. Implemented double-tap exit mechanism. Refactored PromptOverlay for auto-adaptive width and CJK character support. Added physical padding for opaque popups and enhanced thinking state protection.
- **cli**: Modularize Ink components and enhance UI layout
- **cli**: Integrate Pi-Agent core and clean up legacy architecture
- **cli**: Simplify slash UX and input area with model meta line
- **cli**: Refine input UI and sync blessed docs
- **ui**: Extract welcome card logic and add unit tests
- **core**: Decouple index.ts into Factory, TerminalManager and REPL modules
- **core**: Restructure to hexagonal architecture (core/apps), add F17 runtime separation

### Chores

- **docs**: Update docs and configure husky pre-commit hooks
- **ci**: Add ESLint + Prettier config and update README
- **ci**: Add CI, lint configs, error logging and TS strict mode
- **git hooks**: Clean up old script files, unify using hooks/ and scripts/feishu_webhook.py
- **git hooks**: Move install.sh to git_hooks folder
- **git hooks**: Add install.sh for project setup
- **git hooks**: Remove setup_hooks.sh, no longer needed
- **docs**: Add coverage/ to .gitignore
- **ci**: Update Ink TUI components and archive docs
- **deps**: Cleanup unused dependencies and optimize package.json
- **docs**: Restructure documentation for Pi-Agent architecture
- **docs**: Add session requirements N3-N5 and renumber plan
- **docs**: Reorganize documentation structure and add ROADMAP
- **docs**: Restructure development and milestone documentation
- **docs**: Rename project title in README and add technology stack documentation
- **ci**: Rename project to CodeAgent-win

### Tests

- **cli**: Verify post-commit hook report
- **ink**: Establish N12 automated test system - Vitest + ink-testing-library
