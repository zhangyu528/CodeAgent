/**
 * Escape Sequence Chat Renderer
 * Renders chat messages using ANSI escape sequences for smooth streaming.
 *
 * Layout:
 *   Row 0-1: Header (fixed)
 *   Row 2: Separator
 *   Row 3 to (T-5): Messages scroll region (DECSTBM)
 *   Row (T-4): Separator
 *   Row (T-3) to T: Input (fixed)
 */

import { TerminalScrollRegion } from './terminalScroll.js';
import { ChatMessage, ChatMessageBlock, ChatMessageRole } from '../pages/types.js';

const ESC = '\x1b';
const CSI = `${ESC}[`;

export interface RenderOptions {
  headerRows: number;
  footerRows: number;
  totalRows?: number;
  totalCols?: number;
}

// ANSI colors
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
  bgGray: '\x1b[100m',
  bgYellow: '\x1b[43m',
};

function roleColor(role: ChatMessageRole): string {
  switch (role) {
    case 'user': return colors.cyan;
    case 'assistant': return colors.blue;
    case 'error': return colors.red;
    default: return colors.yellow;
  }
}

function formatBlock(block: ChatMessageBlock): string[] {
  const lines: string[] = [];

  if (block.kind === 'thinking') {
    const collapsed = (block as { collapsed?: boolean }).collapsed !== false;
    if (collapsed) {
      lines.push(`${colors.gray}▸ [Thinking]${colors.reset}`);
    } else {
      lines.push(`${colors.gray}▾ [Thinking]${colors.reset}`);
      lines.push(...block.text.split('\n').map(l => `${colors.gray}${l}${colors.reset}`));
    }
    return lines;
  }

  if (block.kind === 'reasoning') {
    const collapsed = (block as { collapsed?: boolean }).collapsed !== false;
    if (collapsed) {
      lines.push(`${colors.gray}▸ [Reasoning]${colors.reset}`);
    } else {
      lines.push(`${colors.gray}▾ [Reasoning]${colors.reset}`);
      lines.push(...block.text.split('\n').map(l => `${colors.gray}${l}${colors.reset}`));
    }
    return lines;
  }

  if (block.kind === 'toolSummary') {
    const collapsed = (block as { collapsed?: boolean }).collapsed !== false;
    if (collapsed) {
      lines.push(`${colors.gray}▸ [Tools]${colors.reset}`);
    } else {
      lines.push(`${colors.gray}▾ [Tools]${colors.reset}`);
      const toolLines = block.text.split('\n').filter(l => l.trim());
      for (let i = 0; i < toolLines.length; i++) {
        const prefix = i === toolLines.length - 1 ? '└── ' : '├── ';
        lines.push(`${colors.gray}${prefix}${toolLines[i]}${colors.reset}`);
      }
    }
    return lines;
  }

  // Text block
  return block.text.split('\n');
}

function formatMessage(msg: ChatMessage): string[] {
  const lines: string[] = [];
  const color = roleColor(msg.role);

  // Role label with border
  const borderColor = colors.dim;
  lines.push(`${borderColor}│${colors.reset} ${color}${colors.bold}${msg.role}${colors.reset}`);

  // Blocks
  for (const block of msg.blocks) {
    const blockLines = formatBlock(block);
    for (const line of blockLines) {
      lines.push(`${borderColor}│${colors.reset} ${line}`);
    }
  }

  return lines;
}

function formatHeader(sessionName?: string): string[] {
  const lines: string[] = [];
  const width = process.stdout.columns || 80;
  const border = '─'.repeat(width);

  lines.push(`${colors.blue}${colors.bold}┌${border}┐${colors.reset}`);
  lines.push(`${colors.blue}│${colors.reset} Chat ${sessionName ? `- ${sessionName}` : ''}`.padEnd(width) + `${colors.blue}│${colors.reset}`);
  lines.push(`${colors.blue}${colors.bold}└${border}┘${colors.reset}`);

  return lines;
}

function formatInputLine(prompt: string = '>'): string {
  const width = process.stdout.columns || 80;
  const promptColor = colors.cyan;
  return `${promptColor}${prompt}${colors.reset} `;
}

export class EscapeChatRenderer {
  private scrollRegion: TerminalScrollRegion;
  private headerRows: number;
  private footerRows: number;
  private messages: ChatMessage[] = [];
  private sessionName?: string;
  private isActive: boolean = false;

  constructor(options: RenderOptions) {
    this.headerRows = options.headerRows;
    this.footerRows = options.footerRows;

    this.scrollRegion = new TerminalScrollRegion({
      totalRows: options.totalRows || process.stdout.rows || 24,
      totalCols: options.totalCols || process.stdout.columns || 80,
      headerRows: this.headerRows,
      footerRows: this.footerRows,
    });
  }

  /**
   * Start rendering
   */
  start(): void {
    this.isActive = true;
    this.scrollRegion.init();
    this.render();
  }

  /**
   * Stop rendering and cleanup
   */
  stop(): void {
    this.isActive = false;
    this.scrollRegion.cleanup();
  }

  /**
   * Handle terminal resize
   */
  resize(): void {
    if (!this.isActive) return;
    const rows = process.stdout.rows || 24;
    const cols = process.stdout.columns || 80;
    this.scrollRegion.resize(rows, cols);
    this.render();
  }

  /**
   * Set session name
   */
  setSession(sessionName?: string): void {
    this.sessionName = sessionName;
    if (this.isActive) {
      this.render();
    }
  }

  /**
   * Add a new message
   */
  addMessage(msg: ChatMessage): void {
    this.messages.push(msg);
    if (this.isActive) {
      const lines = formatMessage(msg);
      for (const line of lines) {
        this.scrollRegion.writeLine(line);
      }
    }
  }

  /**
   * Update the last message (for streaming)
   */
  updateLastMessage(updater: (msg: ChatMessage) => ChatMessage): void {
    if (this.messages.length === 0) return;
    const lastIndex = this.messages.length - 1;
    this.messages[lastIndex] = updater(this.messages[lastIndex]);
    if (this.isActive) {
      // Re-render all messages
      this.renderMessages();
    }
  }

  /**
   * Set messages (for resume/history)
   */
  setMessages(messages: ChatMessage[]): void {
    this.messages = messages;
    if (this.isActive) {
      this.renderMessages();
    }
  }

  /**
   * Render header
   */
  private renderHeader(): void {
    const lines = formatHeader(this.sessionName);
    this.scrollRegion.renderHeader(lines);
  }

  /**
   * Render all messages
   */
  private renderMessages(): void {
    this.scrollRegion.clearScrollRegion();
    this.scrollRegion.enableScrollRegion();

    for (const msg of this.messages) {
      const lines = formatMessage(msg);
      for (const line of lines) {
        this.scrollRegion.writeLine(line);
      }
    }
  }

  /**
   * Render footer with input hint
   */
  private renderFooter(): void {
    const region = this.scrollRegion.getFooterRegion();
    const width = process.stdout.columns || 80;
    const border = '─'.repeat(width);

    const footerLines: string[] = [];
    footerLines.push(`${colors.cyan}${colors.bold}└${border}┘${colors.reset}`);
    footerLines.push(`${colors.cyan}│${colors.reset} ${colors.dim}Type a message...${colors.reset}`.padEnd(width) + `${colors.cyan}│${colors.reset}`);
    footerLines.push(`${colors.cyan}${colors.bold}└${border}┘${colors.reset}`);

    // Write footer at bottom
    const startRow = this.scrollRegion.getRegion().bottom + 2;
    for (let i = 0; i < footerLines.length; i++) {
      const row = startRow + i;
      if (row > (process.stdout.rows || 24)) break;
      process.stdout.write(`${CSI}${row};1H`);
      process.stdout.write(footerLines[i]);
    }
  }

  /**
   * Full render
   */
  render(): void {
    if (!this.isActive) return;

    // Clear and setup
    process.stdout.write(`${CSI}2J`);
    process.stdout.write(`${CSI}H`);

    // Header
    this.renderHeader();

    // Scroll region
    this.scrollRegion.enableScrollRegion();
    this.renderMessages();

    // Footer
    this.renderFooter();
  }

  /**
   * Get scroll region for external use
   */
  getScrollRegion(): TerminalScrollRegion {
    return this.scrollRegion;
  }
}

// Singleton
let rendererInstance: EscapeChatRenderer | null = null;

export function getEscapeChatRenderer(): EscapeChatRenderer {
  if (!rendererInstance) {
    rendererInstance = new EscapeChatRenderer({
      headerRows: 2,
      footerRows: 3,
    });
  }
  return rendererInstance;
}

export function createEscapeChatRenderer(options: RenderOptions): EscapeChatRenderer {
  rendererInstance = new EscapeChatRenderer(options);
  return rendererInstance;
}
