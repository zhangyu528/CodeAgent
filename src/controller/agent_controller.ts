import { LLMEngine } from '../llm/engine';
import { Tool } from '../tools/tool';
import { Message } from '../llm/provider';
import { EventEmitter } from 'events';
import { MemoryManager } from './memory_manager';
import { SecurityLayer } from './security_layer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UIAdapter } from '../cli/ui_adapter';
import { renderUnifiedDiff } from '../cli/diff_renderer';

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

export class AgentController extends EventEmitter {
  private engine: LLMEngine;
  private tools: Map<string, Tool> = new Map();
  private maxIterations = 10;
  private defaultProviderName: string;
  private memory: MemoryManager;
  private security: SecurityLayer;
  private systemPromptContext: { bootSnapshot?: string } | undefined;
  private ui: UIAdapter | undefined;

  constructor(
    engine: LLMEngine,
    tools: Tool[],
    defaultProviderName: string,
    security: SecurityLayer,
    memory?: MemoryManager,
    options?: { maxIterations?: number; systemPromptContext?: { bootSnapshot?: string }; ui?: UIAdapter }
  ) {
    super();
    this.engine = engine;
    this.defaultProviderName = defaultProviderName;
    this.security = security;
    this.memory = memory || new MemoryManager();
    this.maxIterations = options?.maxIterations ?? 10;
    this.systemPromptContext = options?.systemPromptContext;
    this.ui = options?.ui;
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

  private async previewDiffIfNeeded(toolName: string, args: any): Promise<{ allowed: boolean; error?: string }> {
    if (!this.ui) return { allowed: true };

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
      try {
        oldText = await fs.readFile(resolvedPath, 'utf-8');
      } catch {
        oldText = '';
      }
    }

    let newText = '';

    if (toolName === 'write_file') {
      newText = String(args?.content ?? '');
    } else if (toolName === 'replace_content') {
      const target = String(args?.targetContent ?? '');
      const replacement = String(args?.replacementContent ?? '');
      if (!target) return { allowed: true };

      if (!oldText.includes(target)) {
        // Let the tool return its own error message.
        return { allowed: true };
      }

      const occurrences = oldText.split(target).length - 1;
      if (occurrences !== 1) {
        return { allowed: true };
      }

      newText = oldText.replace(target, replacement);
    } else {
      return { allowed: true };
    }

    if (oldText === newText) {
      return { allowed: true };
    }

    const diffText = renderUnifiedDiff(oldText, newText, filePath, 3);

    await this.ui.showDiff(filePath, diffText);

    const shouldConfirm =
      mode === 'always' ||
      (mode === 'smart' && (fileExists || newText.length > 500));
    if (mode === 'off') {
      return { allowed: true };
    }

    if (!shouldConfirm) {
      return { allowed: true };
    }
    const ok = await this.ui.confirmDiff(filePath, diffText, false);
    if (!ok) {
      return { allowed: false, error: 'Error: User denied changes after diff preview.' };
    }

    return { allowed: true };
  }

  async run(task: string, initialMessages?: Message[]): Promise<{ content: string; messages: Message[] }> {
    const { getSystemPrompt } = require('../prompts/system_prompt');
    const systemPromptMessage = { role: 'system' as const, content: getSystemPrompt(this.systemPromptContext) };

    this.memory.setSystemPrompt(systemPromptMessage);

    if (initialMessages && initialMessages.length > 0) {
      this.memory.addMessages(initialMessages.filter(m => m.role !== 'system'));
    }

    if (task) {
      this.memory.addMessage({ role: 'user', content: task });
    }

    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;
      this.emit('onThought', `Thinking (Iteration ${iteration})...`);

      try {
        const providerTools = this.getProviderTools();
        const messages = this.memory.getMessages();

        const response = await this.engine.generate(this.defaultProviderName, messages, providerTools);
        const message = response.message;

        this.emit('onCompletion', {
          provider: this.defaultProviderName,
          inputTokens: response.usage?.promptTokens || 0,
          outputTokens: response.usage?.completionTokens || 0,
        });

        this.memory.addMessage(message);

        // If LLM wants to call a tool
        if (message.toolCalls && message.toolCalls.length > 0) {
          for (const toolCall of message.toolCalls) {
            const toolName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);

            this.emit('onToolStarted', toolName, args);

            const tool = this.tools.get(toolName);
            let result = '';

            if (tool) {
              // 1. Security Check
              let isAllowed = true;

              // Path validation (Files)
              if (args.filePath && !this.security.validatePath(args.filePath)) {
                result = `Error: Security Block. Path is outside of workspace: ${args.filePath}`;
                isAllowed = false;
              }
              // Path validation (Directories)
              else if (args.directoryPath && !this.security.validatePath(args.directoryPath)) {
                result = `Error: Security Block. Directory is outside of workspace: ${args.directoryPath}`;
                isAllowed = false;
              }
              else if (toolName === 'web_search') {
                const check = this.security.checkWebText(String(args.query || ''));
                if (!check.isSafe) {
                  result = `Error: Security block. ${check.reason}`;
                  isAllowed = false;
                } else if (check.needsApproval) {
                  const prompt = {
                    type: 'security',
                    level: riskLevelFromText(check.reason || ''),
                    title: 'Web search',
                    detail: String(args.query || ''),
                    reason: check.reason,
                  };
                  const approved = await this.security.requestApproval(JSON.stringify(prompt));
                  if (!approved) {
                    result = 'Error: Web search denied by user.';
                    isAllowed = false;
                  }
                }
              }
              else if (toolName === 'browse_page') {
                const urlStr = String(args.url || '');
                const urlCheck = this.security.checkUrl(urlStr);
                if (!urlCheck.isSafe) {
                  result = `Error: Security block. ${urlCheck.reason}`;
                  isAllowed = false;
                } else if (urlCheck.needsApproval) {
                  const prompt = {
                    type: 'security',
                    level: riskLevelFromText(urlCheck.reason || ''),
                    title: 'Browse page',
                    detail: urlStr,
                    reason: urlCheck.reason,
                  };
                  const approved = await this.security.requestApproval(JSON.stringify(prompt));
                  if (!approved) {
                    result = 'Error: Browse denied by user.';
                    isAllowed = false;
                  }
                }

                const textCheck = this.security.checkWebText(urlStr);
                if (isAllowed && textCheck.needsApproval) {
                  const prompt = {
                    type: 'security',
                    level: riskLevelFromText(textCheck.reason || ''),
                    title: 'Browse page',
                    detail: urlStr,
                    reason: textCheck.reason,
                  };
                  const approved = await this.security.requestApproval(JSON.stringify(prompt));
                  if (!approved) {
                    result = 'Error: Browse denied by user.';
                    isAllowed = false;
                  }
                }
              }
              else if (toolName === 'run_command') {
                // Command validation
                const check = this.security.checkCommand(args.command);
                if (!check.isSafe) {
                  result = `Error: Security block. ${check.reason}`;
                  isAllowed = false;
                } else if (check.needsApproval) {
                  const prompt = {
                    type: 'security',
                    level: riskLevelFromText(String(args.command || '') + ' ' + String(check.reason || '')),
                    title: 'Execute command',
                    detail: String(args.command || ''),
                    reason: check.reason,
                  };
                  const approved = await this.security.requestApproval(JSON.stringify(prompt));
                  if (!approved) {
                    result = 'Error: Command execution denied by user.';
                    isAllowed = false;
                  }
                }
              }

              // 2. Diff preview middleware for file mutations
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

            this.emit('onToolFinished', toolName, result);

            this.memory.addMessage({
              role: 'tool',
              content: result,
              toolCallId: toolCall.id,
            });
          }
        } else {
          // If no tools are called, return the LLM's text as the final answer
          this.emit('onFinalAnswer', message.content);
          return { content: message.content, messages: this.memory.getMessages() };
        }
      } catch (error: any) {
        this.emit('onError', error);
        throw error;
      }
    }

    throw new Error(`Max iterations (${this.maxIterations}) reached.`);
  }

  async askStream(prompt: string, onData: (chunk: string) => void, opts?: { signal?: AbortSignal }): Promise<void> {
    const { getSystemPrompt } = require('../prompts/system_prompt');
    const systemPromptMessage = { role: 'system' as const, content: getSystemPrompt(this.systemPromptContext) };

    this.memory.setSystemPrompt(systemPromptMessage);

    if (prompt) {
      this.memory.addMessage({ role: 'user', content: prompt });
    }

    try {
      const messages = this.memory.getMessages();
      const stream = this.engine.generateStream(this.defaultProviderName, messages, undefined, { signal: opts?.signal } as any);
      let fullResponse = '';

      for await (const chunk of stream) {
        fullResponse += chunk;
        onData(chunk);
      }

      this.memory.addMessage({ role: 'assistant', content: fullResponse });
      this.emit('onFinalAnswer', fullResponse);
    } catch (error: any) {
      this.emit('onError', error);
      throw error;
    }
  }
}



