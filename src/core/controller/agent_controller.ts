import { LLMEngine } from '../llm/engine';
import { Tool } from '../tools/tool';
import { Message } from '../llm/provider';
import { MemoryManager } from './memory_manager';
import { SecurityLayer } from './security_layer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IUIAdapter } from '../interfaces/ui';
import { renderUnifiedDiff } from '../../apps/cli/components/diff_renderer';
import { SessionService } from '../session/service';
import { SessionSummary } from '../session/types';
import { getSystemPrompt } from '../prompts/system_prompt';

type DiffConfirmMode = 'always' | 'smart' | 'off';

function parseDiffConfirmMode(): DiffConfirmMode {
  const raw = (process.env.DIFF_CONFIRM || 'smart').toLowerCase();
  if (raw === 'always' || raw === 'off' || raw === 'smart') return raw;
  return 'smart';
}

function riskLevelFromText(text: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  const t = (text || '').toLowerCase();
  if (t.includes('rm ') || t.includes('rm -rf') || t.includes('mkfs') || t.includes('format') || t.includes('chmod -r')) return 'HIGH';
  if (t.includes('npm install') || t.includes('npm i ') || t.includes('curl ') || t.includes('wget ') || t.includes('non-standard port')) return 'MEDIUM';
  return 'LOW';
}

export class AgentController {
  private engine: LLMEngine;
  private tools: Map<string, Tool> = new Map();
  private maxIterations = 10;
  private defaultProviderName: string;
  private memory: MemoryManager;
  private security: SecurityLayer;
  private systemPromptContext: { bootSnapshot?: string } | undefined;
  private ui: IUIAdapter;
  private sessionService: SessionService | undefined;
  private activeSessionId: string | null = null;

  constructor(
    engine: LLMEngine,
    tools: Tool[],
    defaultProviderName: string,
    security: SecurityLayer,
    ui: IUIAdapter,
    memory?: MemoryManager,
    options?: { maxIterations?: number; systemPromptContext?: { bootSnapshot?: string }; sessionService?: SessionService | undefined }
  ) {
    this.engine = engine;
    this.defaultProviderName = defaultProviderName;
    this.security = security;
    this.ui = ui;
    this.memory = memory || new MemoryManager();
    this.maxIterations = options?.maxIterations ?? 10;
    this.systemPromptContext = options?.systemPromptContext;
    this.sessionService = options?.sessionService;
    tools.forEach(tool => this.tools.set(tool.name, tool));
  }

  private getProviderTools() {
    return Array.from(this.tools.values()).map(tool => {
      const shape = (tool.parameters as any).shape;
      const properties: any = {};
      const required: string[] = [];

      if (shape) {
        for (const key of Object.keys(shape)) {
          properties[key] = {
            type: shape[key]._def.typeName === 'ZodString' ? 'string' : 'object',
            description: shape[key].description || '',
          };
          if (!shape[key].isOptional()) {
            required.push(key);
          }
        }
      }

      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: properties,
            required: required,
          },
        },
      };
    });
  }

  getMemoryUsage(): number {
    return this.memory.getUsage();
  }

  getMemory(): MemoryManager {
    return this.memory;
  }

  getProviderName(): string {
    return this.defaultProviderName;
  }

  setProviderName(name: string) {
    this.defaultProviderName = name;
  }

  getModelName(): string {
    const provider = this.engine.getProvider(this.defaultProviderName);
    return provider?.getModel?.() || 'unknown';
  }

  async listModels(): Promise<string[]> {
    const provider = this.engine.getProvider(this.defaultProviderName);
    return provider?.listModels?.() || [];
  }

  setModel(model: string) {
    const provider = this.engine.getProvider(this.defaultProviderName);
    provider?.setModel?.(model);
  }

  switchProvider(name: string) {
    if (!this.engine.hasProvider(name)) {
      throw new Error(`Provider ${name} is not registered.`);
    }
    this.defaultProviderName = name;
  }

  setUIAdapter(ui: IUIAdapter) {
    this.ui = ui;
  }

  getAuthorizedPath(): string {
    return this.security.getWorkspaceRoot();
  }

  getCurrentSessionId(): string | null {
    return this.activeSessionId;
  }

  listRecentSessions(limit: number = 10): SessionSummary[] {
    if (!this.sessionService) return [];
    return this.sessionService.listRecentSessions(limit);
  }

  createNewSession(initialPrompt?: string): { sessionId: string; replay: Message[] } | null {
    if (!this.sessionService) return null;

    const session = initialPrompt && initialPrompt.trim()
      ? this.sessionService.createSession({
        initialPrompt,
        provider: this.getProviderName(),
        model: this.getModelName(),
        cwd: this.getAuthorizedPath(),
      })
      : this.sessionService.createEmptySession({
        provider: this.getProviderName(),
        model: this.getModelName(),
        cwd: this.getAuthorizedPath(),
      });

    this.activeSessionId = session.id;
    const replay = this.sessionService.getSessionMessagesAsLLM(session.id);
    this.resetMemoryWithHistory(replay);
    return { sessionId: session.id, replay };
  }

  resumeSession(sessionId: string): { sessionId: string; replay: Message[] } {
    if (!this.sessionService) {
      throw new Error('Session service is not enabled.');
    }
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const replay = this.sessionService.getSessionMessagesAsLLM(sessionId);
    this.activeSessionId = sessionId;
    this.resetMemoryWithHistory(replay);
    return { sessionId, replay };
  }

  endCurrentSession(): void {
    if (!this.sessionService || !this.activeSessionId) return;
    this.sessionService.endSession(this.activeSessionId);
    this.activeSessionId = null;

  }
  resetActiveSession(): void {
    this.activeSessionId = null;
    this.memory.clearHistory();
  }
  markCurrentSessionInterrupted(): void {
    if (!this.sessionService || !this.activeSessionId) return;
    this.sessionService.markInterrupted(this.activeSessionId);
  }

  private resetMemoryWithHistory(history: Message[]): void {
    this.memory.clearHistory();
    this.memory.addMessages(history.filter(m => m.role !== 'system'));
  }

  private ensureSessionForPrompt(prompt: string): { sessionId: string | null; alreadyPersistedUser: boolean } {
    if (!this.sessionService) return { sessionId: null, alreadyPersistedUser: false };

    if (!this.activeSessionId) {
      const created = this.createNewSession(prompt);
      if (!created) return { sessionId: null, alreadyPersistedUser: false };
      return { sessionId: created.sessionId, alreadyPersistedUser: true };
    }

    return { sessionId: this.activeSessionId, alreadyPersistedUser: false };
  }

  private async previewDiffIfNeeded(toolName: string, args: any): Promise<{ allowed: boolean; error?: string }> {
    const mode = parseDiffConfirmMode();
    const filePath: string = String(args?.filePath || '').trim();
    if (!filePath) return { allowed: true };

    const resolvedPath = path.resolve(process.cwd(), filePath);
    let oldText = '';
    let fileExists = false;
    try {
      const stat = await fs.stat(resolvedPath);
      fileExists = stat.isFile();
    } catch {
      fileExists = false;
    }

    if (fileExists) {
      try { oldText = await fs.readFile(resolvedPath, 'utf-8'); } catch { oldText = ''; }
    }

    let newText = '';
    if (toolName === 'write_file') {
      newText = String(args?.content ?? '');
    } else if (toolName === 'replace_content') {
      const target = String(args?.targetContent ?? '');
      const replacement = String(args?.replacementContent ?? '');
      if (!target) return { allowed: true };
      if (!oldText.includes(target)) return { allowed: true };
      const occurrences = oldText.split(target).length - 1;
      if (occurrences !== 1) return { allowed: true };
      newText = oldText.replace(target, replacement);
    } else {
      return { allowed: true };
    }

    if (oldText === newText) return { allowed: true };

    const diffText = renderUnifiedDiff(oldText, newText, filePath, 3);
    this.ui.print(diffText);

    const shouldConfirm = mode === 'always' || (mode === 'smart' && (fileExists || newText.length > 500));
    if (mode === 'off' || !shouldConfirm) return { allowed: true };

    const ok = await this.ui.confirm(`Apply changes to ${filePath}?`);
    if (!ok) return { allowed: false, error: 'Error: User denied changes after diff preview.' };

    return { allowed: true };
  }

  async run(task: string, initialMessages?: Message[]): Promise<{ content: string; messages: Message[] }> {
    const systemPromptMessage = { role: 'system' as const, content: getSystemPrompt(this.systemPromptContext) };

    this.memory.setSystemPrompt(systemPromptMessage);
    if (initialMessages && initialMessages.length > 0) {
      this.memory.addMessages(initialMessages.filter(m => m.role !== 'system'));
    }

    const sessionInfo = this.ensureSessionForPrompt(task);
    if (task) {
      if (!sessionInfo.alreadyPersistedUser) {
        this.memory.addMessage({ role: 'user', content: task });
        if (sessionInfo.sessionId && this.sessionService) {
          this.sessionService.appendUserMessage(sessionInfo.sessionId, task);
        }
      }
    }

    let iteration = 0;
    while (iteration < this.maxIterations) {
      iteration++;
      this.ui.onThink(`Thinking (Iteration ${iteration})...`);

      try {
        const providerTools = this.getProviderTools();
        const messages = this.memory.getMessages();

        const response = await this.engine.generate(this.defaultProviderName, messages, providerTools);
        const message = response.message;

        this.ui.onStatusUpdate({
          type: 'completion',
          provider: this.defaultProviderName,
          inputTokens: response.usage?.promptTokens || 0,
          outputTokens: response.usage?.completionTokens || 0,
        });

        this.memory.addMessage(message);

        if (message.toolCalls && message.toolCalls.length > 0) {
          for (const toolCall of message.toolCalls) {
            const toolName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);

            this.ui.onToolStart(toolName, args);

            const tool = this.tools.get(toolName);
            let result = '';

            if (tool) {
              let isAllowed = true;
              if (args.filePath && !this.security.validatePath(args.filePath)) {
                result = `Error: Security Block. Path is outside of workspace: ${args.filePath}`;
                isAllowed = false;
              } else if (args.directoryPath && !this.security.validatePath(args.directoryPath)) {
                result = `Error: Security Block. Directory is outside of workspace: ${args.directoryPath}`;
                isAllowed = false;
              } else if (toolName === 'web_search' || toolName === 'browse_page' || toolName === 'run_command') {
                let check: any;
                if (toolName === 'web_search') check = this.security.checkWebText(String(args.query || ''));
                else if (toolName === 'browse_page') check = this.security.checkUrl(String(args.url || ''));
                else check = this.security.checkCommand(String(args.command || ''));

                if (!check.isSafe) {
                  result = `Error: Security block. ${check.reason}`;
                  isAllowed = false;
                } else if (check.needsApproval) {
                  const approved = await this.ui.confirm(`Security Approval: ${check.reason}\nAction: ${toolName} ${JSON.stringify(args)}\nProceed?`);
                  if (!approved) {
                    result = `Error: ${toolName} denied by user.`;
                    isAllowed = false;
                  }
                }
              }

              if (isAllowed && (toolName === 'write_file' || toolName === 'replace_content')) {
                const preview = await this.previewDiffIfNeeded(toolName, args);
                if (!preview.allowed) {
                  result = preview.error || 'Error: User denied changes after diff preview.';
                  isAllowed = false;
                }
              }

              if (isAllowed) {
                result = await tool.execute(args);
              }
            } else {
              result = `Error: Tool ${toolName} not found.`;
            }

            this.ui.onToolEnd(toolName, result);
            this.memory.addMessage({ role: 'tool', content: result, toolCallId: toolCall.id });
            if (sessionInfo.sessionId && this.sessionService) {
              this.sessionService.appendToolMessage(sessionInfo.sessionId, toolName, result, args);
            }
          }
        } else {
          this.ui.onStatusUpdate({ type: 'final_answer', content: message.content });
          if (sessionInfo.sessionId && this.sessionService) {
            this.sessionService.appendAssistantMessage(sessionInfo.sessionId, message.content || '');
          }
          return { content: message.content, messages: this.memory.getMessages() };
        }
      } catch (error: any) {
        this.ui.error(error.message || String(error));
        throw error;
      }
    }
    throw new Error(`Max iterations (${this.maxIterations}) reached.`);
  }

  async askStream(prompt: string, opts?: { signal?: AbortSignal; sessionId?: string }): Promise<void> {
    const systemPromptMessage = { role: 'system' as const, content: getSystemPrompt(this.systemPromptContext) };

    this.memory.setSystemPrompt(systemPromptMessage);

    if (opts?.sessionId && this.sessionService) {
      this.resumeSession(opts.sessionId);
    }

    const sessionInfo = this.ensureSessionForPrompt(prompt);

    if (!sessionInfo.alreadyPersistedUser && prompt) {
      this.memory.addMessage({ role: 'user', content: prompt });
      if (sessionInfo.sessionId && this.sessionService) {
        this.sessionService.appendUserMessage(sessionInfo.sessionId, prompt);
      }
    }

    try {
      const messages = this.memory.getMessages();
      const stream = this.engine.generateStream(this.defaultProviderName, messages, undefined, { signal: opts?.signal } as any);
      let fullResponse = '';

      for await (const chunk of stream) {
        fullResponse += chunk;
        this.ui.onStream(chunk);
      }

      this.memory.addMessage({ role: 'assistant', content: fullResponse });
      if (sessionInfo.sessionId && this.sessionService) {
        this.sessionService.appendAssistantMessage(sessionInfo.sessionId, fullResponse);
      }
      this.ui.onStatusUpdate({ type: 'final_answer', content: fullResponse });
    } catch (error: any) {
      this.ui.error(error.message || String(error));
      throw error;
    }
  }
}
