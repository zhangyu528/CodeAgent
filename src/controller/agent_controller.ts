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

  // Convert Zod schema to JSON Schema for the LLM
  private getProviderTools() {
    return Array.from(this.tools.values()).map(tool => {
        // Simple mock of JSON schema formatting for MVP
        // Wait, realistically we'd use zod-to-json-schema
        return {
          type: 'function',
          function: {
              name: tool.name,
              description: tool.description,
              parameters: {
                  type: 'object',
                  properties: {}, // Would be parsed from Zod in reality
              }
          }
        };
    });
  }

  async run(task: string): Promise<string> {
    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful coding agent. Use provided tools to solve the task.' },
      { role: 'user', content: task }
    ];

    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;
      this.emit('onThought', `Thinking (Iteration ${iteration})...`);

      try {
        const response = await this.engine.generate(this.defaultProviderName, messages); // Assuming tools are passed in engine if needed
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
          return message.content;
        }

      } catch (error: any) {
        this.emit('onError', error);
        throw error; // Or handle/retry
      }
    }

    throw new Error(`Max iterations (${this.maxIterations}) reached without a final answer.`);
  }
}
