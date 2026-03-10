import { LLMEngine } from '../llm/engine';
import { Tool } from '../tools/tool';
import { Message } from '../llm/provider';
import { EventEmitter } from 'events';

export class AgentController extends EventEmitter {
  private engine: LLMEngine;
  private tools: Map<string, Tool> = new Map();
  private maxIterations = 10;
  private defaultProviderName: string;

  constructor(engine: LLMEngine, tools: Tool[], defaultProviderName: string) {
    super();
    this.engine = engine;
    this.defaultProviderName = defaultProviderName;
    tools.forEach(tool => this.tools.set(tool.name, tool));
  }

  private getProviderTools() {
    return Array.from(this.tools.values()).map(tool => {
        // Simple manual conversion from Zod to JSON Schema for MVP
        // For actual production, use zod-to-json-schema
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

  async run(task: string, initialMessages?: Message[]): Promise<{ content: string; messages: Message[] }> {
    const { getSystemPrompt } = require('../prompts/system_prompt');
    const systemPromptMessage = getSystemPrompt();

    // If initialMessages are provided, we reuse them. 
    // Otherwise, we start fresh with system prompt + user task.
    let messages: Message[] = initialMessages || [
      { role: 'system', content: systemPromptMessage },
      { role: 'user', content: task }
    ];

    // If history was provided but it doesn't have the task, add it.
    // (This helps if we want to "continue" a session with a new instruction)
    if (initialMessages && initialMessages.length > 0 && task) {
       messages.push({ role: 'user', content: task });
    }

    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;
      this.emit('onThought', `Thinking (Iteration ${iteration})...`);

      try {
        const providerTools = this.getProviderTools();
        const response = await this.engine.generate(this.defaultProviderName, messages, providerTools);
        const message = response.message;
        
        messages.push(message);

        // If LLM wants to call a tool
        if (message.toolCalls && message.toolCalls.length > 0) {
          for (const toolCall of message.toolCalls) {
            const toolName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);
            
            this.emit('onToolStarted', toolName, args);
            
            const tool = this.tools.get(toolName);
            let result: string;
            
            if (tool) {
               result = await tool.execute(args);
            } else {
               result = `Error: Tool ${toolName} not found.`;
            }
            
            this.emit('onToolFinished', toolName, result);
            
            messages.push({
              role: 'tool',
              content: result,
              toolCallId: toolCall.id
            });
          }
        } else {
          // If no tools are called, returned the LLM's text as the final answer
          this.emit('onFinalAnswer', message.content);
          return { content: message.content, messages };
        }

      } catch (error: any) {
        this.emit('onError', error);
        throw error; // Or handle/retry
      }
    }

    throw new Error(`Max iterations (${this.maxIterations}) reached without a final answer.`);
  }
}
