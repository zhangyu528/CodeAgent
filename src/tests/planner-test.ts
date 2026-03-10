import { LLMEngine } from '../llm/engine';
import { AgentController } from '../controller/agent_controller';
import { Planner } from '../controller/planner';
import { ReadFileTool } from '../tools/read_file_tool';
import { WriteFileTool } from '../tools/write_file_tool';
import { RunCommandTool } from '../tools/run_command_tool';
import { GLMProvider } from '../llm/glm_provider';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testPlanner() {
  console.log('=== Running CodeAgent P1 Planner Test ===\n');

  try {
    const engine = new LLMEngine();
    const glmProvider = new GLMProvider(process.env.GLM_API_KEY);
    engine.registerProvider(glmProvider);

    const tools = [
      new ReadFileTool(),
      new WriteFileTool(),
      new RunCommandTool()
    ];

    const controller = new AgentController(engine, tools, 'glm');
    const planner = new Planner(engine, 'glm');

    // Observability
    controller.on('onThought', (t) => console.log('\x1b[90m%s\x1b[0m', `  [Thought] ${t}`));
    controller.on('onToolStarted', (n, a) => console.log('\x1b[33m%s\x1b[0m', `  [Action] ${n}`, a));
    controller.on('onFinalAnswer', (ans) => console.log('\x1b[32m%s\x1b[0m', `  [Answer] ${ans}`));

    const objective = "Create a directory 'temp/p1_dist', create a file 'info.txt' inside it with the text 'Hello from Planner', and list the directory to confirm.";

    console.log(`[Objective]: ${objective}\n`);

    // Step 1: Create Plan
    console.log('--- Generating Plan ---');
    const plan = await planner.createPlan(objective);
    console.log('Detected Steps:');
    plan.steps.forEach(s => console.log(` - ${s.id}: ${s.description}`));

    // Step 2: Execute Plan
    console.log('\n--- Executing Plan ---');
    await planner.executePlan(plan, controller);

    console.log('\n=== Planner Test Finished Successfully ===');

  } catch (err: any) {
    console.error('\n[Fatal Error]', err.message || err);
  }
}

testPlanner();
