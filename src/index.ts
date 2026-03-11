#!/usr/bin/env ts-node
import { input, confirm } from '@inquirer/prompts';
import * as dotenv from 'dotenv';\n
import { LLMEngine } from './llm/engine';
import { GLMProvider } from './llm/glm_provider';
import { AgentController } from './controller/agent_controller';
import { MemoryManager } from './controller/memory_manager';
import { SecurityLayer } from './controller/security_layer';
import { logger, TelemetryMonitor } from './utils/logger';

// Tools
import { ReadFileTool } from './tools/read_file_tool';
import { WriteFileTool } from './tools/write_file_tool';
import { RunCommandTool } from './tools/run_command_tool';
import { ListDirectoryTool } from './tools/list_directory_tool';
import { FileSearchTool } from './tools/file_search_tool';
import { ReplaceContentTool } from './tools/replace_content_tool';
import { SystemInfoTool } from './tools/system_info_tool';
import { EchoTool } from './tools/echo_tool';
import { WebSearchTool } from './tools/web_search_tool';
import { BrowsePageTool } from './tools/browse_page_tool';

// Load environment variables
dotenv.config();

const telemetry = new TelemetryMonitor();

async function createAgent() {
  const engine = new LLMEngine();

  if (!process.env.GLM_API_KEY) {
    logger.error('GLM_API_KEY is missing in .env file.');
    process.exit(1);
  }

  engine.registerProvider(new GLMProvider(process.env.GLM_API_KEY));

  // HITL Approval Handler using @inquirer/prompts
  const approvalHandler = async (description: string) => {
    logger.stopSpinner();
    const answer = await confirm({
      message: `[Security] ${description}. Allow?`,
      default: false
    });
    return answer;
  };

  const security = new SecurityLayer(process.cwd(), approvalHandler);

  const tools = [
    new ReadFileTool(),
    new WriteFileTool(),
    new RunCommandTool(),
    new ListDirectoryTool(),
    new FileSearchTool(),
    new ReplaceContentTool(),
    new SystemInfoTool(),
    new EchoTool(),
    new WebSearchTool(),
    new BrowsePageTool(security),
  ];

  const memory = new MemoryManager(4000);
  const controller = new AgentController(engine, tools, 'glm', security, memory);

  // Setup Observability with the new Logger
  controller.on('onThought', (text) => {
    logger.startSpinner('Thinking...');
    logger.thought(text);
  });

  controller.on('onToolStarted', (name, args) => {
    logger.startSpinner(`Executing ${name}...`);
    logger.action(name, args);
  });

  controller.on('onToolFinished', (name, result) => {
    logger.observation(name, result);
  });

  controller.on('onCompletion', (usage) => {
    telemetry.record(usage.inputTokens, usage.outputTokens);
    logger.tokenUsage(controller.getMemoryUsage(), telemetry);
  });

  controller.on('onFinalAnswer', (ans) => {
    logger.answer(ans);
  });

  controller.on('onError', (err) => {
    logger.error(err.message || String(err));
  });

  return { controller };
}

async function startREPL() {
  const { controller } = await createAgent();

  console.log(require('chalk').bold.cyan('\n=== CodeAgent Interactive Mode ==='));
  console.log(require('chalk').dim('Type "exit" or "quit" to end the session.\n'));

  while (true) {
    try {
      const task = await input({
        message: require('chalk').blue('CodeAgent >'),
      });

      if (!task || task.trim() === '') continue;
      if (['exit', 'quit'].includes(task.toLowerCase().trim())) {
        logger.info('Goodbye!');
        process.exit(0);
      }

      await controller.run(task);
    } catch (e: any) {
      if (e.message?.includes('force closed')) {
        process.exit(0);
      }
      logger.error('Error during execution: ' + e.message);
    }
  }
}

startREPL().catch(err => {
  logger.error('Fatal error: ' + err.message);
  process.exit(1);
});

