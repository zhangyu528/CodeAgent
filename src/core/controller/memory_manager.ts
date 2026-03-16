import { Message } from '../llm/provider';

export class MemoryManager {
  private history: Message[] = [];
  private maxTokens: number;
  private systemPrompt?: Message;

  constructor(maxTokens: number = 4000) {
    this.maxTokens = maxTokens;
  }

  setSystemPrompt(prompt: Message) {
    this.systemPrompt = prompt;
  }

  addMessage(message: Message) {
    this.history.push(message);
    this.truncateIfNeeded();
  }

  addMessages(messages: Message[]) {
    this.history.push(...messages);
    this.truncateIfNeeded();
  }

  getMessages(): Message[] {
    const result: Message[] = [];
    if (this.systemPrompt) {
      result.push(this.systemPrompt);
    }
    return [...result, ...this.history];
  }

  clearHistory() {
    this.history = [];
  }

  getUsage(): number {
    return this.estimateTokens(this.getMessages());
  }

  /**
   * Simple token estimation (approx 4 chars per token)
   * In a real app, use a library like tiktoken.
   */
  private estimateTokens(messages: Message[]): number {
    return messages.reduce((acc, msg) => {
      let contentLen = msg.content ? msg.content.length : 0;
      if (msg.toolCalls) {
        contentLen += JSON.stringify(msg.toolCalls).length;
      }
      return acc + Math.ceil(contentLen / 4);
    }, 0);
  }

  private truncateIfNeeded() {
    // We always keep the system prompt.
    // We truncate from the beginning of the history (excluding system prompt).
    // CRITICAL: GLM API requires alternation and tool message consistency.
    
    while (this.history.length > 0 && this.estimateTokens(this.getMessages()) > this.maxTokens) {
      // Remove the oldest message
      this.history.shift();
      
      // Recovery: Ensure the history always starts with a 'user' message.
      // If we shifted a 'user' message, we might be left with an 'assistant' or 'tool' message.
      // We must continue shifting until the first message is a 'user' message.
      while (this.history.length > 0 && this.history[0] && this.history[0].role !== 'user') {
        this.history.shift();
      }
    }
  }
}
