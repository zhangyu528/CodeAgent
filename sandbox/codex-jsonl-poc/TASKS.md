# Implementation Task List

## 1) Protocol
- Define JSON-RPC lite message shapes
- Lock JSONL framing (one JSON per line, `\n`-terminated)
- Document error codes and message examples

## 2) Node Agent (stdio JSONL)
- Implement JSONL decoder (buffer + split by `\n`)
- Implement JSONL encoder (one line per message)
- Add method routing and handlers
- Implement `initialize`, `agent/ping`, `agent/echo`, `shutdown`
- Emit `agent/notify` as a server notification
- Log to stderr only

## 3) SwiftUI Client
- Process lifecycle (spawn/terminate)
- stdio pipes (read/write separation)
- JSONL decoder (buffer + split by `\n`)
- JSON-RPC dispatcher (pending requests map)
- ViewModel state binding for UI

## 4) Lifecycle and Errors
- Normal shutdown flow
- Handle parse errors and unknown methods
- Detect agent exit and surface status

## 5) End-to-End Validation
- Initialize → ping → echo roundtrip
- Notifications from Node → UI state update
- Chunked/partial message handling
