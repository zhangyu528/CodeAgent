export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  publishedAt?: string;
}

export interface WebSearchOptions {
  numResults: number;
  recencyDays: number;
  site?: string;
  language: string;
}

export interface SearchProvider {
  name: string;
  search(query: string, options: WebSearchOptions): Promise<WebSearchResult[]>;
}
