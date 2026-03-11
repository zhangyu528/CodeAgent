function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/');
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ''));
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function extractTitleFromHtml(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m?.[1]) return normalizeWhitespace(stripTags(m[1]));

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) return normalizeWhitespace(stripTags(h1[1]));

  return '';
}

function removeNoisyBlocks(html: string): string {
  const patterns = [
    /<script[\s\S]*?<\/script>/gi,
    /<style[\s\S]*?<\/style>/gi,
    /<noscript[\s\S]*?<\/noscript>/gi,
    /<svg[\s\S]*?<\/svg>/gi,
    /<nav[\s\S]*?<\/nav>/gi,
    /<header[\s\S]*?<\/header>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
    /<aside[\s\S]*?<\/aside>/gi,
  ];

  let out = html;
  for (const p of patterns) out = out.replace(p, '');

  // Remove common ad/promo blocks by class/id heuristics
  out = out.replace(
    /<([a-z0-9]+)([^>]*\s(?:class|id)=(?:"|')([^"']*)(?:"|')[^>]*)>[\s\S]*?<\/\1>/gi,
    (full, tag, attrs, cls) => {
      const key = String(cls || '').toLowerCase();
      if (/(advert|ads|ad-|ad_|banner|cookie|consent|subscribe|promo|newsletter|social|share|comment|footer|header|nav|sidebar)/i.test(key)) {
        return '';
      }
      return full;
    }
  );

  return out;
}

function sliceByTag(html: string, tag: 'article' | 'main' | 'body'): string {
  const start = html.search(new RegExp(`<${tag}\\b`, 'i'));
  if (start < 0) return '';
  const end = html.search(new RegExp(`</${tag}>`, 'i'));
  if (end < 0 || end <= start) return html.slice(start);
  return html.slice(start, end + tag.length + 3);
}

export function extractMainHtml(html: string): string {
  const cleaned = removeNoisyBlocks(html);

  const article = sliceByTag(cleaned, 'article');
  const main = sliceByTag(cleaned, 'main');
  const body = sliceByTag(cleaned, 'body');

  const candidates = [article, main, body, cleaned].filter(Boolean);
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] || cleaned;
}

function htmlToMarkdownBasic(html: string): string {
  let out = html;

  // Code blocks
  out = out.replace(/<pre[\s\S]*?<code[^>]*>([\s\S]*?)<\/code>[\s\S]*?<\/pre>/gi, (_m, code) => {
    const text = decodeEntities(code.replace(/<[^>]+>/g, ''));
    return `\n\n\`\`\`\n${text.trim()}\n\`\`\`\n\n`;
  });

  // Inline code
  out = out.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, code) => {
    const text = decodeEntities(code.replace(/<[^>]+>/g, '')).trim();
    if (!text) return '';
    return '`' + text.replace(/`/g, '\\`') + '`';
  });

  // Headings
  out = out.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, content) => {
    const n = Number(level);
    const text = normalizeWhitespace(stripTags(content));
    return `\n\n${'#'.repeat(n)} ${text}\n\n`;
  });

  // Links
  out = out.replace(/<a[^>]*href=(?:"|')([^"']+)(?:"|')[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
    const label = normalizeWhitespace(stripTags(text)) || href;
    return `[${label}](${href})`;
  });

  // Lists
  out = out.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, content) => {
    const text = normalizeWhitespace(stripTags(content));
    return `\n- ${text}`;
  });

  // Paragraphs and breaks
  out = out.replace(/<br\s*\/?>/gi, '\n');
  out = out.replace(/<p[^>]*>/gi, '\n\n');
  out = out.replace(/<\/p>/gi, '\n\n');
  out = out.replace(/<div[^>]*>/gi, '\n\n');
  out = out.replace(/<\/div>/gi, '\n\n');

  // Remove remaining tags
  out = stripTags(out);

  return normalizeWhitespace(out);
}

export function htmlToMarkdown(html: string): string {
  return htmlToMarkdownBasic(html);
}

export function markdownToPlainText(md: string): string {
  return normalizeWhitespace(
    md
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/```[\s\S]*?```/g, m => stripTags(m.replace(/```/g, '')))
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/`([^`]+)`/g, '$1')
  );
}

export function buildSummary(title: string, markdown: string): string {
  const lines = markdown
    .split(/\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('```'));

  const top = lines.slice(0, 8);
  const bullets = top.filter(l => l.startsWith('- ')).slice(0, 3);
  const paras = top.filter(l => !l.startsWith('- ')).slice(0, 3);

  const parts: string[] = [];
  if (title) parts.push(title);
  if (paras.length) parts.push(paras.join('\n'));
  if (bullets.length) parts.push(bullets.join('\n'));

  return normalizeWhitespace(parts.join('\n\n'));
}

export function truncateWithMarker(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.6);
  const tail = Math.floor(maxChars * 0.3);
  const omitted = text.length - head - tail;
  return text.slice(0, head) + `\n\n...[truncated ${omitted} characters]...\n\n` + text.slice(text.length - tail);
}

