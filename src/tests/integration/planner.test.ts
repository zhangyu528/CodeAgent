import { LLMEngine } from '../../llm/engine';
import { AgentController } from '../../controller/agent_controller';
import { Planner } from '../../controller/planner';
import { ReadFileTool } from '../../tools/read_file_tool';
import { WriteFileTool } from '../../tools/write_file_tool';
import { RunCommandTool } from '../../tools/run_command_tool';
import { SecurityLayer } from '../../controller/security_layer';
import { MemoryManager } from '../../controller/memory_manager';
import { MockProvider } from '../../llm/mock_provider';

async function testPlanner() {
  console.log('=== Running CodeAgent P1 Planner Test (MockProvider) ===\n');

  const engine = new LLMEngine();
  engine.registerProvider(new MockProvider());

  const tools = [new ReadFileTool(), new WriteFileTool(), new RunCommandTool()];

  const security = new SecurityLayer(process.cwd());
  const memory = new MemoryManager(4000);
  const controller = new AgentController(engine, tools, 'mock', security, memory);
  const planner = new Planner(engine, 'mock');

  const objective = "Create a directory 'temp/p1_dist', create a file 'info.txt' inside it with the text 'Hello from Planner', and list the directory to confirm.";

  console.log(`[Objective]: ${objective}\n`);

  console.log('--- Generating Plan ---');
  const plan = await planner.createPlan(objective);
  console.log('Detected Steps:');
  plan.steps.forEach((s: any) => console.log(` - ${s.id}: ${s.description}`));

  console.log('\n--- Executing Plan ---');
  await planner.executePlan(plan, controller);

  console.log('\n=== Planner Test Finished Successfully ===');
}

testPlanner().catch(err => {
  console.error('\n[Fatal Error]', err.message || err);
  process.exit(1);
});
