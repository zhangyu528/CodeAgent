import { LLMEngine } from '../../core/llm/engine';
import { AgentController } from '../../core/controller/agent_controller';
import { Planner } from '../../core/controller/planner';
import { ReadFileTool } from '../../core/tools/read_file_tool';
import { WriteFileTool } from '../../core/tools/write_file_tool';
import { RunCommandTool } from '../../core/tools/run_command_tool';
import { SecurityLayer } from '../../core/controller/security_layer';
import { MemoryManager } from '../../core/controller/memory_manager';
import { MockProvider } from '../../core/llm/mock_provider';

export async function test() {
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

const isMain = Boolean(process.argv[1]) && import.meta.url.endsWith(process.argv[1]!.replace(/\\\\/g, '/'));
if (isMain) {
  test().catch(err => {
    console.error('\n[Fatal Error]', err.message || err);
    process.exit(1);
  });
}
