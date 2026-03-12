# Agent Validation Log

This log records the requirements, plan, and minimal verification for:
- Toggleable tool logs (`LOG_TOOL_CALLS`)
- Controlled planning mode (`PLANNING_MODE`)

## Requirements

1. `LOG_TOOL_CALLS=true` should print tool call + result summaries.
2. `PLANNING_MODE=off|on|auto` should control whether Planner is used.
3. Planning path must not recursively re-plan on summary.

## Plan (Summary)

- Add `LOG_TOOL_CALLS` flag to emit `[tool_call]` and `[tool_result]`.
- Add `PLANNING_MODE` with `off|on|auto`.
- `on`: force Planner → execute steps → summarize results.
- `auto`: trigger planning based on length/keywords.
- Prevent recursive planning in summary via guard.

## Verification Results

### Test 1 — `LOG_TOOL_CALLS=true` (acceptance)

Command:
```
LOG_TOOL_CALLS=true npm run acceptance
```

Result:
- **PASS**. Output included:
  - `[tool_call] read_file ...`
  - `[tool_result] read_file -> ...`

### Test 2 — `PLANNING_MODE=on` (p1-acceptance)

Commands:
```
PLANNING_MODE=on LOG_TOOL_CALLS=true npm run p1-acceptance
PLANNING_MODE=on LOG_TOOL_CALLS=true REQUEST_TIMEOUT_MS=2000 npm run p1-acceptance
```

Result:
- **INCONCLUSIVE**. `p1-acceptance` hung at “Planning...” twice; process terminated.

### Test 3 — `PLANNING_MODE=on` (acceptance)

Command:
```
PLANNING_MODE=on LOG_TOOL_CALLS=true npm run acceptance
```

Result:
- **FAILED** due to provider rate limit (retry still limited):
  - `GLM request failed: 429 Too Many Requests (code 1302)`

## Notes

- Planning-mode verification needs retry once provider rate limits clear.
- The tool log toggle is validated.
