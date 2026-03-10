# CodeAgent

Minimal runnable loop: **LLM → Tool → Result** using GLM HTTP + Provider pattern.

## Quick Start

1. Install deps

```bash
npm install
```

2. Create `.env`

```bash
cp .env.example .env
```

3. Set env vars in `.env`

```
GLM_API_KEY=your_api_key
GLM_MODEL=your_model_name
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
```

4. Run demo

```bash
npm run demo
```

## Notes

- `GLM_BASE_URL` and `GLM_MODEL` may differ based on your GLM account/plan.
- The demo uses the `echo` tool and a two-step loop (tool call + final answer).
