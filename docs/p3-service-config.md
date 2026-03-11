# P3 Service Configuration

This document describes the runtime configuration for the HTTP service.

## Required

- `GLM_API_KEY`: API key for the GLM provider.
- `GLM_MODEL`: model name for chat completion.

## Optional (Recommended)

- `GLM_BASE_URL`: override provider base URL.
- `SERVER_API_KEY`: enables API key auth for `/run`. If unset, `/run` is open.
- `REQUEST_TIMEOUT_MS`: request-level timeout in milliseconds (default: 60000).
- `MAX_CONCURRENCY`: maximum concurrent `/run` requests (default: 2).
- `LOG_FILE_PATH`: if set, request logs are appended to this file.
- `PORT`: server port (default: 3000).

## Example

```
GLM_API_KEY=your_api_key
GLM_MODEL=glm-4.7
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
SERVER_API_KEY=dev-local-123
REQUEST_TIMEOUT_MS=60000
MAX_CONCURRENCY=2
LOG_FILE_PATH=./logs/server.log
PORT=3000
```
