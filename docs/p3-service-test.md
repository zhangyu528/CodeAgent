# P3 Service Test Checklist

This checklist verifies authentication, timeout, concurrency, and request logging
for the `/run` service endpoint.

## Preconditions

- `.env` has `GLM_API_KEY` and `GLM_MODEL` configured.
- Use temporary test settings:
  - `SERVER_API_KEY=dev-local-123`
  - `REQUEST_TIMEOUT_MS=2000`
  - `MAX_CONCURRENCY=1`

## Steps

1. Start server
   ```bash
   npm run serve
   ```

2. Health check
   ```bash
   curl http://localhost:3000/health
   ```
   Expected: `{"ok":true}`

3. Auth check (no key)
   ```bash
   curl -X POST http://localhost:3000/run \
     -H "Content-Type: application/json" \
     -d '{"task":"hello"}'
   ```
   Expected: `401 Unauthorized` with JSON `{ error, traceId }`

4. Auth check (valid key)
   ```bash
   curl -X POST http://localhost:3000/run \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer dev-local-123" \
     -d '{"task":"Read README.md and summarize"}'
   ```
   Expected: timeout error when `REQUEST_TIMEOUT_MS=2000` (HTTP 504).

5. Concurrency check
   ```bash
   curl -s -X POST http://localhost:3000/run -H "Content-Type: application/json" \
     -H "Authorization: Bearer dev-local-123" -d '{"task":"Read README.md and summarize"}' &
   curl -s -X POST http://localhost:3000/run -H "Content-Type: application/json" \
     -H "Authorization: Bearer dev-local-123" -d '{"task":"Read README.md and summarize"}' &
   wait
   ```
   Expected: one response is `429 Too many requests` (rate-limited).

6. Log verification
   Check server console output for lines like:
   ```
   [request] traceId=... method=POST path=/run status=401 durationMs=0 error="unauthorized"
   [request] traceId=... method=POST path=/run status=504 durationMs=2001 error="Request timeout"
   [request] traceId=... method=POST path=/run status=429 durationMs=0 error="rate_limited"
   ```

