import { LLMEngine } from '../llm/engine';
import { AgentController } from '../controller/agent_controller';
import { ReadFileTool } from '../tools/read_file_tool';
import { EchoTool } from '../tools/echo_tool';
import { GLMProvider } from '../llm/glm_provider';
import { SecurityLayer } from '../controller/security_layer';
import { MemoryManager } from '../controller/memory_manager';
import { WriteFileTool } from '../tools/write_file_tool';
import { RunCommandTool } from '../tools/run_command_tool';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function runTests() {
  console.log('=== Running CodeAgent P0 MVP Tests ===\n');
  
  try {
    // 1. Initialize Tools
    const readFileTool = new ReadFileTool();
    const echoTool = new EchoTool();
    const writeFileTool = new WriteFileTool();
    const runCommandTool = new RunCommandTool();
    const tools = [readFileTool, echoTool, writeFileTool, runCommandTool];

    // 2. Initialize Engine & GLM Provider
    const engine = new LLMEngine();
    const glmProvider = new GLMProvider(process.env.GLM_API_KEY);
    engine.registerProvider(glmProvider);

    // 3. Initialize Controller
    const security = new SecurityLayer(process.cwd());
    const memory = new MemoryManager(4000);
    const controller = new AgentController(engine, tools, 'glm', security, memory);

    // 4. Setup Observability Hooks
    controller.on('onThought', (text: string) => console.log('\x1b[36m%s\x1b[0m', `[Thought] ${text}`));
    controller.on('onToolStarted', (name: string, args: any) => console.log('\x1b[33m%s\x1b[0m', `[Action] Calling Tool: ${name}`, args));
    controller.on('onToolFinished', (name: string, result: any) => {
      let resStr = typeof result === 'string' ? result : JSON.stringify(result);
      if (!resStr) resStr = '';
      console.log('\x1b[35m%s\x1b[0m', `[Observation] Tool ${name} returned:`, resStr.substring(0, 150) + (resStr.length > 150 ? '...' : ''));
    });
    controller.on('onError', (err: any) => console.error('\x1b[31m%s\x1b[0m', `[Fatal Error]`, err.message || err));

    // Test Case: Read, Write and List Files using LLM
    const testFilePath = 'package.json';
    const outputFilePath = 'temp/test_run_output.txt';
    const task = `Please list all files in the current directory using run_command tool (dir command for windows). Then read package.json, and write a summary into '${outputFilePath}'.`;

    console.log(`\n[User Task]: ${task}\n`);
    const { content: finalAnswer } = await controller.run(task);

    console.log('\n=======================================');
    console.log('\x1b[32m%s\x1b[0m', `[Final Answer]\n${finalAnswer}`);
    console.log('=======================================\n');

  } catch (err: any) {
    console.error('\x1b[31m%s\x1b[0m', 'Test Execution Failed:', err.message);
  }
}

runTests();
