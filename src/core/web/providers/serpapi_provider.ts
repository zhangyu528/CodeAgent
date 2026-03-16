import { SearchProvider, WebSearchOptions, WebSearchResult } from '../search_provider';

export class SerpApiProvider implements SearchProvider {
  name = 'serpapi';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.SERPAPI_API_KEY || '';
    this.baseUrl = baseUrl || process.env.SERPAPI_API_URL || 'https://serpapi.com/search.json';
  }

  async search(query: string, options: WebSearchOptions): Promise<WebSearchResult[]> {
    if (!this.apiKey) {
      throw new Error('SERPAPI_API_KEY is missing. Please set it in .env file.');
    }

    const q = options.site ? `${query} site:${options.site}` : query;
    const params = new URLSearchParams({
      engine: 'google',
      q,
      api_key: this.apiKey,
      hl: options.language || 'zh-CN',
      num: String(options.numResults),
    });

    const days = Math.max(1, Math.floor(options.recencyDays));
    if (days <= 1) params.set('tbs', 'qdr:d');
    else if (days <= 7) params.set('tbs', 'qdr:w');
    else if (days <= 31) params.set('tbs', 'qdr:m');
    else params.set('tbs', 'qdr:y');

    const url = `${this.baseUrl}?${params.toString()}`;
    const res = await fetch(url, { method: 'GET' });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SerpAPI Error: ${res.status} - ${text}`);
    }

    const data: any = await res.json();
    const organic: any[] = Array.isArray(data?.organic_results) ? data.organic_results : [];

    return organic.slice(0, options.numResults).map((r: any) => {
      const item: any = {
        title: String(r?.title || ''),
        url: String(r?.link || ''),
        snippet: String(r?.snippet || ''),
        source: 'google',
      };
      if (r?.date) item.publishedAt = String(r.date);
      return item as WebSearchResult;
    });
  }
}
