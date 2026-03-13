# Codex-Style JSONL POC

This is an isolated proof-of-concept for SwiftUI ↔ Node stdio JSON-RPC (JSONL) communication.

## Layout
- `protocol/` Protocol notes and JSONL examples
- `node-agent/` Node test agent (stdio JSONL)
- `swiftui-client/` SwiftUI client code (stdio JSONL)

## Run (Node agent only)
```bash
node /Users/eric/Documents/CodeAgent/sandbox/codex-jsonl-poc/node-agent/index.js
```

## Notes
- stdout is reserved for JSONL RPC messages.
- stderr is reserved for logs.
