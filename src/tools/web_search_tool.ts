import { Tool } from './tool';
import { z } from 'zod';
import { SearchProvider, WebSearchOptions, WebSearchResult } from '../web/search_provider';
import { TavilyProvider } from '../web/providers/tavily_provider';
import { SerpApiProvider } from '../web/providers/serpapi_provider';

const MAX_RESULTS = 10;
const DEFAULT_RESULTS = 5;
const DEFAULT_RECENCY_DAYS = 7;
const DEFAULT_LANGUAGE = 'zh-CN';

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function truncate(text: string, maxLen: number) {
  if (text.length <= maxLen) return text;
  return text.slice(0, Math.max(0, maxLen - 12)) + '...[truncated]';
}

function pickProvider(): SearchProvider {
  const provider = (process.env.WEB_SEARCH_PROVIDER || 'tavily').toLowerCase();
  if (provider === 'serpapi') return new SerpApiProvider();
  return new TavilyProvider();
}

function shrinkResults(results: WebSearchResult[], maxTotalChars: number): WebSearchResult[] {
  const out: WebSearchResult[] = results.map(r => ({ ...r }));
  let total = JSON.stringify(out).length;
  if (total <= maxTotalChars) return out;

  for (const r of out) {
    r.snippet = truncate(r.snippet || '', 300);
  }
  total = JSON.stringify(out).length;
  if (total <= maxTotalChars) return out;

  for (const cap of [200, 120, 80, 40]) {
    for (const r of out) r.snippet = truncate(r.snippet || '', cap);
    total = JSON.stringify(out).length;
    if (total <= maxTotalChars) return out;
  }

  return out;
}

export class WebSearchTool implements Tool {
  name = 'web_search';
  description = 'Search the web in real time via a configured provider (Tavily/SerpAPI) and return a concise list of results.';
  parameters = z.object({
    query: z.string().describe('Search query text.'),
    numResults: z.number().optional().default(DEFAULT_RESULTS).describe('Number of results to return (default 5, max 10).'),
    recencyDays: z.number().optional().default(DEFAULT_RECENCY_DAYS).describe('Prefer results within recent N days (default 7).'),
    site: z.string().optional().describe('Optional site filter, e.g. github.com.'),
    language: z.string().optional().default(DEFAULT_LANGUAGE).describe('Preferred language/locale, e.g. zh-CN (default).'),
  });

  async execute(args: { query: string; numResults?: number; recencyDays?: number; site?: string; language?: string }): Promise<string> {
    const provider = pickProvider();

    const site = args.site?.trim() ? args.site.trim() : undefined;
    const options: WebSearchOptions = {
      numResults: clampInt(args.numResults ?? DEFAULT_RESULTS, 1, MAX_RESULTS),
      recencyDays: clampInt(args.recencyDays ?? DEFAULT_RECENCY_DAYS, 1, 3650),
      language: (args.language || DEFAULT_LANGUAGE).trim() || DEFAULT_LANGUAGE,
      ...(site ? { site } : {}),
    };

    const fetchedAt = new Date().toISOString();
    const query = String(args.query || '').trim();
    if (!query) return JSON.stringify({ query: '', results: [], fetchedAt, error: 'query is required' });

    try {
      const results = await provider.search(query, options);

      const safeResults = shrinkResults(
        results
          .filter(r => r.url && r.title)
          .slice(0, options.numResults)
          .map(r => {
            const item: any = {
              title: truncate(String(r.title || ''), 200),
              url: truncate(String(r.url || ''), 800),
              snippet: truncate(String(r.snippet || ''), 500),
            };
            if (r.source) item.source = r.source;
            if (r.publishedAt) item.publishedAt = r.publishedAt;
            return item as WebSearchResult;
          }),
        12000
      );

      return JSON.stringify({ query, provider: provider.name, results: safeResults, fetchedAt });
    } catch (e: any) {
      return JSON.stringify({
        query,
        provider: provider.name,
        results: [],
        fetchedAt,
        error: e?.message || String(e),
      });
    }
  }
}
