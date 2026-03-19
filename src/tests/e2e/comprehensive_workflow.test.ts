import { LLMEngine } from '../../core/llm/engine';
import { AgentController } from '../../core/controller/agent_controller';
import { Planner } from '../../core/controller/planner';
import { ReadFileTool } from '../../core/tools/read_file_tool';
import { WriteFileTool } from '../../core/tools/write_file_tool';
import { RunCommandTool } from '../../core/tools/run_command_tool';
import { ListDirectoryTool } from '../../core/tools/list_directory_tool';
import { FileSearchTool } from '../../core/tools/file_search_tool';
import { ReplaceContentTool } from '../../core/tools/replace_content_tool';
import { SecurityLayer } from '../../core/controller/security_layer';
import { MemoryManager } from '../../core/controller/memory_manager';
import { MockProvider } from '../../core/llm/mock_provider';

async function runComprehensiveTests() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   CodeAgent P1 Comprehensive Tests   ║');
  console.log('╚══════════════════════════════════════╝\n');

  const engine = new LLMEngine();
  engine.registerProvider(new MockProvider());

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
  const controller = new AgentController(engine, tools, 'mock', security, memory, { maxIterations: 20 });
  const planner = new Planner(engine, 'mock');

  try {
    console.log('\n--- [Test 1] Context Continuity & New Tools ---');
    const task = "Search for 'GLMProvider' in 'src/llm', find the filename, then list the content of 'src/tools' to see if 'list_directory_tool.ts' exists, and finally create a file 'temp/comp_test.txt' saying 'I found everything'.";

    console.log(`[Task]: ${task}`);
    await controller.run(task);
    console.log('\x1b[32m%s\x1b[0m', `✅ Multi-step Task Completed.`);

    console.log('\n--- [Test 2] Planner Dynamic Re-planning ---');
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
    process.exit(1);
  }
}

runComprehensiveTests();
