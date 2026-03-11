import { SearchProvider, WebSearchOptions, WebSearchResult } from '../search_provider';

export class TavilyProvider implements SearchProvider {
  name = 'tavily';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.TAVILY_API_KEY || '';
    this.baseUrl = baseUrl || process.env.TAVILY_API_URL || 'https://api.tavily.com/search';
  }

  async search(query: string, options: WebSearchOptions): Promise<WebSearchResult[]> {
    if (!this.apiKey) {
      throw new Error('TAVILY_API_KEY is missing. Please set it in .env file.');
    }

    const payload: any = {
      api_key: this.apiKey,
      query: options.site ? `${query} site:${options.site}` : query,
      max_results: options.numResults,
      search_depth: 'basic',
      include_answer: false,
      include_raw_content: false,
    };

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Tavily API Error: ${res.status} - ${text}`);
    }

    const data: any = await res.json();
    const results: any[] = Array.isArray(data?.results) ? data.results : [];

    return results.map((r: any) => {
      const item: any = {
        title: String(r?.title || ''),
        url: String(r?.url || ''),
        snippet: String(r?.content || r?.snippet || ''),
      };
      if (r?.source) item.source = String(r.source);
      if (r?.published_date) item.publishedAt = String(r.published_date);
      return item as WebSearchResult;
    });
  }
}
