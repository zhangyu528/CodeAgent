import { LLMEngine } from './llm/engine';
import { AgentController } from './controller/agent_controller';
import { ReadFileTool } from './tools/read_file_tool';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function boot() {
  console.log('Booting CodeAgent P0 MVP...');
  
  // 1. Initialize Tools
  const readFileTool = new ReadFileTool();
  const tools = [readFileTool];

  // 2. Initialize Engine (Providers would be registered here in full implementation)
  const engine = new LLMEngine();

  // Mock Provider for demonstration purposes
  /*
  engine.registerProvider(new OpenAIProvider(process.env.OPENAI_API_KEY));
  */

  // 3. Initialize Controller
  const defaultProvider = 'openai'; // Placeholder
  const controller = new AgentController(engine, tools, defaultProvider);

  // 4. Setup Event Listeners for Observability
  controller.on('onThought', (text) => console.log(`[Agent Thinking] ${text}`));
  controller.on('onToolStarted', (name, args) => console.log(`[Agent Action] Calling Tool: ${name} with args:`, args));
  controller.on('onToolFinished', (name, result) => console.log(`[Agent Observation] Tool ${name} Returned:`, result.substring(0, 100) + '...'));
  controller.on('onFinalAnswer', (text) => console.log(`\n[Final Answer]\n${text}`));
  controller.on('onError', (err) => console.error(`[Fatal Error]`, err));

  console.log('CodeAgent MVP initialized successfully.\n');
  
  // Usage Example:
  // await controller.run("Read the package.json file and summarize it");
}

boot().catch(console.error);
