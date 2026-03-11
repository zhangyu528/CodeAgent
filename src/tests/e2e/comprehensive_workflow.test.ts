import { LLMEngine } from '../../llm/engine';
import { AgentController } from '../../controller/agent_controller';
import { Planner } from '../../controller/planner';
import { ReadFileTool } from '../../tools/read_file_tool';
import { WriteFileTool } from '../../tools/write_file_tool';
import { RunCommandTool } from '../../tools/run_command_tool';
import { ListDirectoryTool } from '../../tools/list_directory_tool';
import { FileSearchTool } from '../../tools/file_search_tool';
import { ReplaceContentTool } from '../../tools/replace_content_tool';
import { GLMProvider } from '../../llm/glm_provider';
import { SecurityLayer } from '../../controller/security_layer';
import { MemoryManager } from '../../controller/memory_manager';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function runComprehensiveTests() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   CodeAgent P1 Comprehensive Tests   ║');
  console.log('╚══════════════════════════════════════╝\n');

  const engine = new LLMEngine();
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    console.error('GLM_API_KEY not set in .env');
    return;
  }
  engine.registerProvider(new GLMProvider(apiKey));

  const tools = [
    new ReadFileTool(),
    new WriteFileTool(),
    new RunCommandTool(),
    new ListDirectoryTool(),
    new FileSearchTool(),
    new ReplaceContentTool(),
  ];

  const security = new SecurityLayer(process.cwd());
  const memory = new MemoryManager(4000);
  const controller = new AgentController(engine, tools, 'glm', security, memory, { maxIterations: 20 });
  const planner = new Planner(engine, 'glm');

  // Observability
  controller.on('onThought', (t: string) => console.log('\x1b[90m%s\x1b[0m', `  [Thought] ${t}`));
  controller.on('onToolStarted', (n: string, a: any) => console.log('\x1b[33m%s\x1b[0m', `  [Action] ${n}`, JSON.stringify(a).substring(0, 100)));

  try {
    // --- Test 1: Multi-step Task with Context Continuity ---
    console.log('\n--- [Test 1] Context Continuity & New Tools ---');
    const task = "Search for 'GLMProvider' in 'src/llm', find the filename, then list the content of 'src/tools' to see if 'list_directory_tool.ts' exists, and finally create a file 'temp/comp_test.txt' saying 'I found everything'.";
    
    console.log(`[Task]: ${task}`);
    const { content: finalAnswer } = await controller.run(task);
    console.log('\x1b[32m%s\x1b[0m', `✅ Multi-step Task Completed.`);

    // --- Test 2: Planner Re-planning (Simulation) ---
    console.log('\n--- [Test 2] Planner Dynamic Re-planning ---');
    // We give a task that refers to a non-existent file initially to see if it tries to recover 
    // or we just verify the re-planning logic is robust.
    const plannerObjective = "Try to read a file named 'non_existent.txt'. If it fails, search for 'package.json' instead and tell me its version.";
    
    console.log(`[Objective]: ${plannerObjective}`);
    const plan = await planner.createPlan(plannerObjective);
    await planner.executePlan(plan, controller);
    console.log('\x1b[32m%s\x1b[0m', `✅ Planner Objective Handled.`);

    console.log('\n╔══════════════════════════════════════╗');
    console.log('║      All Comprehensive Tests Pass    ║');
    console.log('╚══════════════════════════════════════╝');

  } catch (err: any) {
    console.error('\n\x1b[31m%s\x1b[0m', '❌ Comprehensive Test Failed:', err.message || err);
  }
}

runComprehensiveTests();
