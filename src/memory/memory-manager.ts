import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Message } from "../types.js";

export interface MemoryManagerOptions {
  maxItems?: number;
  storageDir?: string;
  summarize?: (items: Message[]) => Promise<Message>;
}

export class MemoryManager {
  private messages: Message[] = [];
  private maxItems: number;
  private storageDir: string;
  private summarizeFn?: (items: Message[]) => Promise<Message>;

  constructor(options?: MemoryManagerOptions) {
    this.maxItems = options?.maxItems ?? 40;
    this.storageDir = options?.storageDir ?? path.resolve(process.cwd(), ".memory");
    this.summarizeFn = options?.summarize;
  }

  async add(message: Message) {
    this.messages.push(message);
    if (this.messages.length > this.maxItems) {
      if (this.summarizeFn && this.messages.length > 1) {
        const overflow = this.messages.slice(0, this.messages.length - this.maxItems + 1);
        const summary = await this.summarizeFn(overflow);
        const trimmed = this.messages.slice(this.messages.length - this.maxItems + 1);
        this.messages = [summary, ...trimmed];
      } else {
        this.messages = this.messages.slice(this.messages.length - this.maxItems);
      }
    }
  }

  getSnapshot(): Message[] {
    return [...this.messages];
  }

  async saveState(sessionId: string): Promise<void> {
    await mkdir(this.storageDir, { recursive: true });
    const payload = JSON.stringify({ messages: this.messages }, null, 2);
    const filePath = this.resolveSessionPath(sessionId);
    await writeFile(filePath, payload, "utf-8");
  }

  async loadState(sessionId: string): Promise<void> {
    const filePath = this.resolveSessionPath(sessionId);
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as { messages?: Message[] };
    this.messages = parsed.messages ?? [];
  }

  private resolveSessionPath(sessionId: string): string {
    return path.resolve(this.storageDir, `${sessionId}.json`);
  }
}
