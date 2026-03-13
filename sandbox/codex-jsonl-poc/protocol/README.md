# Protocol (JSON-RPC Lite over JSONL)

## Message Types
- Request: `{ id, method, params? }`
- Response: `{ id, result }` or `{ id, error }`
- Notification: `{ method, params? }` (no `id`)

## Error Object
```json
{
  "code": -32000,
  "message": "Something went wrong",
  "data": {"detail": "optional"}
}
```

## Standard Error Codes (Suggested)
- `-32700`: Parse error
- `-32601`: Method not found
- `-32000`: Internal error

## Framing
Each message is a single JSON object terminated by `\n`.
