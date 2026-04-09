export function getDisplayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    width += codePoint <= 0xff ? 1 : 2;
  }
  return width;
}

export function truncateToWidth(text: string | undefined, maxWidth: number): string {
  if (text === undefined || maxWidth <= 0) return '';

  let width = 0;
  let result = '';

  for (const char of text) {
    const charWidth = getDisplayWidth(char);
    if (width + charWidth > maxWidth) break;
    result += char;
    width += charWidth;
  }

  return result;
}

export function padToWidth(text: string | undefined, width: number): string {
  if (text === undefined) return '';
  const truncated = truncateToWidth(text, width);
  const visibleWidth = getDisplayWidth(truncated);
  return truncated + ' '.repeat(Math.max(0, width - visibleWidth));
}

export function wrapToWidth(text: string, width: number): string[] {
  if (width <= 0) return [''];

  const normalized = text.replace(/\r\n/g, '\n');
  const paragraphs = normalized.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const char of paragraph) {
      const next = current + char;
      if (getDisplayWidth(next) > width) {
        lines.push(current);
        current = char;
      } else {
        current = next;
      }
    }
    lines.push(current);
  }

  return lines.length > 0 ? lines : [''];
}
