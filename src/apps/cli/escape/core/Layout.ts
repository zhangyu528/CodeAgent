/**
 * Layout — 终端固定布局
 *
 * 终端分为三个固定区域：
 *   Row 1 ~ headerBottom  : Header (固定)
 *   Row scrollTop ~ scrollBottom : Messages (DECSTBM scroll region)
 *   Row inputTop ~ inputBottom   : Input (固定)
 */

export interface Layout {
  rows: number;
  cols: number;
  /** Header 区域 */
  headerTop: number;
  headerBottom: number;
  headerRows: number;
  /** 消息滚动区域 (DECSTBM) */
  scrollTop: number;
  scrollBottom: number;
  scrollRows: number;
  /** 输入区域 */
  inputTop: number;
  inputBottom: number;
  inputRows: number;
  /** 快捷键提示行 */
  hintRow: number;
  hintRows: number;
}

/** 根据终端高度计算布局 */
export function computeLayout(rows: number, cols: number): Layout {
  const headerRows = 2;
  const inputRows = 8; // Input 占用行数
  const hintRows = 1; // 底部快捷键提示行
  const inputBottom = rows; // 输入区从 rows - inputRows + 1 到 rows

  const scrollTop = headerRows + 1; // Row 3 开始
  const scrollBottom = rows - inputRows; // 输入区开始前一行
  const scrollRows = scrollBottom - scrollTop + 1;

  const inputTop = scrollBottom + 1;
  const hintRow = rows - hintRows + 1;

  return {
    rows,
    cols,
    headerTop: 1,
    headerBottom: headerRows,
    headerRows,
    scrollTop,
    scrollBottom,
    scrollRows,
    inputTop,
    inputBottom,
    inputRows,
    hintRow,
    hintRows,
  };
}

/** 全宽分割线 */
export function separator(cols: number, color: string = ''): string {
  const line = '─'.repeat(cols);
  return color ? `${color}${line}\x1b[0m` : line;
}

/** 左对齐文本，右侧补空格到指定宽度 */
export function padRight(text: string, width: number): string {
  return text.padEnd(width).slice(0, width);
}

/** 右对齐文本，左侧补空格 */
export function padLeft(text: string, width: number): string {
  return text.padStart(width).slice(-width);
}

/** 居中文本 */
export function center(text: string, width: number): string {
  const padding = Math.max(0, width - text.length);
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return ' '.repeat(left) + text + ' '.repeat(right);
}

/**
 * 将长文本按指定宽度换行，返回行数组
 */
export function wrapText(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let current = '';

    for (const word of words) {
      const withSpace = current ? `${current} ${word}` : word;
      if (withSpace.length <= maxWidth) {
        current = withSpace;
      } else {
        if (current) lines.push(current);
        if (word.length <= maxWidth) {
          current = word;
        } else {
          // 超长单词切分
          while (word.length > maxWidth) {
            lines.push(word.slice(0, maxWidth));
            current = word.slice(maxWidth);
          }
        }
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}
