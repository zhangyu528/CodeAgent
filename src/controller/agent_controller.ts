import { LLMEngine } from '../llm/engine';
import { Tool } from '../tools/tool';
import { Message } from '../llm/provider';
import { EventEmitter } from 'events';
import { MemoryManager } from './memory_manager';
import { SecurityLayer } from './security_layer';

export class AgentController extends EventEmitter {
  private engine: LLMEngine;
  private tools: Map<string, Tool> = new Map();
  private maxIterations = 10;
  private defaultProviderName: string;
  private memory: MemoryManager;
  private security: SecurityLayer;

  constructor(
    engine: LLMEngine, 
    tools: Tool[], 
    defaultProviderName: string,
    security: SecurityLayer,
    memory?: MemoryManager,
    options?: { maxIterations?: number }
  ) {
    super();
    this.engine = engine;
    this.defaultProviderName = defaultProviderName;
    this.security = security;
    this.memory = memory || new MemoryManager();
    this.maxIterations = options?.maxIterations ?? 10;
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
                    description: shape[key].description || ''
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
                  required: required
              }
          }
        };
    });
  }

  getMemoryUsage(): number {
    return this.memory.getUsage();
  }

  async run(task: string, initialMessages?: Message[]): Promise<{ content: string; messages: Message[] }> {
    const { getSystemPrompt } = require('../prompts/system_prompt');
    const systemPromptMessage = { role: 'system' as const, content: getSystemPrompt() };

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
          inputTokens: response.usage?.promptTokens || 0,
          outputTokens: response.usage?.completionTokens || 0
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
               else if (toolName === 'run_command') {
                 // Command validation
                 const check = this.security.checkCommand(args.command);
                 if (!check.isSafe) {
                   result = `Error: Security block. ${check.reason}`;
                   isAllowed = false;
                 } else if (check.needsApproval) {
                   const approved = await this.security.requestApproval(`Execute command: ${args.command}`);
                   if (!approved) {
                     result = 'Error: Command execution denied by user.';
                     isAllowed = false;
                   }
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
              toolCallId: toolCall.id
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
}
