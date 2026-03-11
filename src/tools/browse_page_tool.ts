import { Tool } from './tool';
import { z } from 'zod';
import { SecurityLayer } from '../controller/security_layer';
import { fetchText } from '../web/fetcher';
import {
  buildSummary,
  extractMainHtml,
  extractTitleFromHtml,
  htmlToMarkdown,
  markdownToPlainText,
  truncateWithMarker,
} from '../web/html_to_markdown';

const DEFAULT_MAX_CHARS = 12000;

function isLikelyMarkdown(url: string, contentType: string): boolean {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('text/markdown')) return true;
  if (ct.includes('text/plain') && url.toLowerCase().endsWith('.md')) return true;
  if (url.toLowerCase().endsWith('.md')) return true;
  return false;
}

export class BrowsePageTool implements Tool {
  name = 'browse_page';
  description = 'Fetch a web page (http/https), extract main content, convert to Markdown/text, and return a concise summary with truncation.';
  parameters = z.object({
    url: z.string().describe('Target URL to browse (http/https only).'),
    maxChars: z.number().optional().default(DEFAULT_MAX_CHARS).describe('Max chars for returned content (default 12000).'),
    format: z.enum(['markdown', 'text']).optional().default('markdown').describe('Return format: markdown (default) or text.'),
  });

  constructor(private security?: SecurityLayer) {}

  async execute(args: { url: string; maxChars?: number; format?: 'markdown' | 'text' }): Promise<string> {
    const fetchedAt = new Date().toISOString();
    const inputUrl = String(args.url || '').trim();
    if (!inputUrl) {
      return JSON.stringify({ url: '', summary: '', content: '', contentType: '', fetchedAt, error: 'url is required' });
    }

    const maxChars = Math.max(500, Math.min(100000, Math.floor(args.maxChars ?? DEFAULT_MAX_CHARS)));
    const format = args.format || 'markdown';

    try {
            const fetchOptions: any = {
        timeoutMs: 15000,
        maxBytes: 2_000_000,
        maxRedirects: 5,
      };
      if (this.security) fetchOptions.security = this.security;

      const res = await fetchText(inputUrl, fetchOptions);

      const contentType = res.contentType;
      const finalUrl = res.finalUrl;

      let title = '';
      let markdown = '';
      let plain = '';

      if (isLikelyMarkdown(finalUrl, contentType)) {
        markdown = res.text;
        plain = markdownToPlainText(markdown);
      } else {
        title = extractTitleFromHtml(res.text);
        const mainHtml = extractMainHtml(res.text);
        markdown = htmlToMarkdown(mainHtml);
        plain = markdownToPlainText(markdown);
      }

      const summary = buildSummary(title, markdown);
      const content = truncateWithMarker(format === 'text' ? plain : markdown, maxChars);

      return JSON.stringify({
        url: inputUrl,
        finalUrl,
        title: title || undefined,
        summary,
        content,
        contentType,
        fetchedAt,
      });
    } catch (e: any) {
      return JSON.stringify({
        url: inputUrl,
        summary: '',
        content: '',
        contentType: '',
        fetchedAt,
        error: e?.message || String(e),
      });
    }
  }
}


