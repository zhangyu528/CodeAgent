## Browser Enhanced Tools (F5)

This release adds two new tools:

- `web_search`: real-time web search via a configured provider.
- `browse_page`: fetch a page and extract main content as Markdown/text with summary + truncation.

### Configuration

Copy `.env.example` to `.env` and set one of the providers:

- `WEB_SEARCH_PROVIDER=tavily` and set `TAVILY_API_KEY`
- `WEB_SEARCH_PROVIDER=serpapi` and set `SERPAPI_API_KEY`

Optional:
- `WEB_PROXY_URL`: safe proxy endpoint for all browse fetches (supports `{url}` placeholder or `?url=` query).
- `WEB_USER_AGENT`: custom user agent.

### Safety

All web requests are guarded by `SecurityLayer`:
- URL scheme must be `http/https`
- blocks localhost / private IPs (SSRF protection)
- non-standard ports require HITL approval
- query/URL text matching sensitive patterns triggers HITL approval
