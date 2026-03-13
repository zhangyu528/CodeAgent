import { LLMEngine } from '../../llm/engine';
import { AgentController } from '../../controller/agent_controller';
import { ReadFileTool } from '../../tools/read_file_tool';
import { EchoTool } from '../../tools/echo_tool';
import { SecurityLayer } from '../../controller/security_layer';
import { MemoryManager } from '../../controller/memory_manager';
import { WriteFileTool } from '../../tools/write_file_tool';
import { RunCommandTool } from '../../tools/run_command_tool';
import { MockProvider } from '../../llm/mock_provider';

export async function test() {
  console.log('=== Running CodeAgent P0 MVP Tests (MockProvider) ===\n');

  try {
    // 1. Initialize Tools
    const tools = [new ReadFileTool(), new EchoTool(), new WriteFileTool(), new RunCommandTool()];

    // 2. Initialize Engine & Mock Provider
    const engine = new LLMEngine();
    engine.registerProvider(new MockProvider());

    // 3. Initialize Controller
    const security = new SecurityLayer(process.cwd());
    const memory = new MemoryManager(4000);
    const controller = new AgentController(engine, tools, 'mock', security, memory);

    // Test Case: Read, Write and List Files using Mock LLM
    const outputFilePath = 'temp/test_run_output.txt';
    const task = `Please list all files in the current directory using run_command tool (dir command for windows). Then read package.json, and write a summary into '${outputFilePath}'.`;

    console.log(`\n[User Task]: ${task}\n`);
    const { content: finalAnswer } = await controller.run(task);

    console.log('\n=======================================');
    console.log('\x1b[32m%s\x1b[0m', `[Final Answer]\n${finalAnswer}`);
    console.log('=======================================\n');
  } catch (err: any) {
    console.error('\x1b[31m%s\x1b[0m', 'Test Execution Failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  test();
}
