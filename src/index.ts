import { LLMEngine } from './llm/engine';
import { AgentController } from './controller/agent_controller';
import { Planner } from './controller/planner';
import { ReadFileTool } from './tools/read_file_tool';
import { WriteFileTool } from './tools/write_file_tool';
import { RunCommandTool } from './tools/run_command_tool';
import { GLMProvider } from './llm/glm_provider';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';

import { ListDirectoryTool } from './tools/list_directory_tool';
import { FileSearchTool } from './tools/file_search_tool';
import { ReplaceContentTool } from './tools/replace_content_tool';
import { SystemInfoTool } from './tools/system_info_tool';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PROVIDER_NAME = 'glm';

/** Check if --plan flag is present in CLI args */
function isPlanMode(): boolean {
  return process.argv.includes('--plan');
}

/** Create the standard tool set, LLM engine, and controller */
function createAgent() {
  // 1. Tools
  const tools = [
    new ReadFileTool(),
    new WriteFileTool(),
    new RunCommandTool(),
    new ListDirectoryTool(),
    new FileSearchTool(),
    new ReplaceContentTool(),
    new SystemInfoTool(),
  ];

  // 2. LLM Engine
  const engine = new LLMEngine();
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    console.error('\x1b[31m%s\x1b[0m', '[Error] GLM_API_KEY not set. Please configure it in .env');
    process.exit(1);
  }
  const glmProvider = new GLMProvider(apiKey);
  engine.registerProvider(glmProvider);

  // 3. Controller
  const controller = new AgentController(engine, tools, PROVIDER_NAME);

  // 4. Observability hooks
  controller.on('onThought', (text) =>
    console.log('\x1b[90m%s\x1b[0m', `  [Thought] ${text}`)
  );
  controller.on('onToolStarted', (name, args) =>
    console.log('\x1b[33m%s\x1b[0m', `  [Action] ${name}`, JSON.stringify(args).substring(0, 120))
  );
  controller.on('onToolFinished', (name, result) => {
    const preview = typeof result === 'string' ? result : JSON.stringify(result);
    console.log(
      '\x1b[35m%s\x1b[0m',
      `  [Observation] ${name} →`,
      (preview || '').substring(0, 150) + (preview && preview.length > 150 ? '...' : '')
    );
  });
  controller.on('onFinalAnswer', (text) =>
    console.log('\x1b[32m%s\x1b[0m', `\n[Answer]\n${text}`)
  );
  controller.on('onError', (err) =>
    console.error('\x1b[31m%s\x1b[0m', `[Error]`, err.message || err)
  );

  // 5. Planner (only used when --plan flag is given)
  const planner = new Planner(engine, PROVIDER_NAME);

  return { controller, planner };
}

/** Interactive CLI read-eval loop */
async function startCLI() {
  const planMode = isPlanMode();
  const { controller, planner } = createAgent();

  console.log('╔══════════════════════════════════════╗');
  console.log('║        CodeAgent P1 — CLI Mode       ║');
  console.log(`║   Mode: ${planMode ? 'Planner (multi-step)  ' : 'Direct  (single-step) '}     ║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('Type your task below. Enter "exit" or "quit" to stop.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Handle Ctrl+C
  rl.on('SIGINT', () => {
    console.log('\nStopping CodeAgent...');
    rl.close();
    process.exit(0);
  });

  const askPrompt = () => {
    rl.question('\x1b[36mYou > \x1b[0m', async (input) => {
      const trimmed = input.trim();
      if (!trimmed || trimmed === 'exit' || trimmed === 'quit') {
        console.log('Goodbye!');
        rl.close();
        return;
      }

      try {
        if (planMode) {
          // Planner mode: decompose → execute step-by-step
          console.log('\n[Planner] Generating plan...');
          const plan = await planner.createPlan(trimmed);
          console.log('[Planner] Steps:');
          plan.steps.forEach(s => console.log(`  ${s.id}. ${s.description}`));
          console.log('');
          await planner.executePlan(plan, controller);
        } else {
          // Direct mode: single AgentController.run
          await controller.run(trimmed);
        }
      } catch (err: any) {
        console.error('\x1b[31m%s\x1b[0m', `[Error] ${err.message || err}`);
      }

      console.log(''); // blank line separator
      askPrompt();
    });
  };

  askPrompt();
}

startCLI().catch(console.error);
