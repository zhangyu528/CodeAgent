#!/usr/bin/env ts-node
import { input, confirm } from '@inquirer/prompts';
import * as dotenv from 'dotenv';

import { LLMEngine } from './llm/engine';
import { registerProvidersFromEnv } from './llm/register_providers';
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

// Load environment variables
dotenv.config();

const telemetry = new TelemetryMonitor();

function formatProviders(list: string[]) {
  return list.length > 0 ? list.join(', ') : '(none)';
}

async function createAgent() {
  const engine = new LLMEngine();

  const reg = registerProvidersFromEnv(engine);
  if (reg.registered.length === 0) {
    logger.error('No LLM providers configured. Please set provider env vars in .env.');
    if (reg.skipped.length > 0) {
      logger.info(`Skipped: ${reg.skipped.map(s => `${s.name}(${s.reason})`).join(' | ')}`);
    }
    process.exit(1);
  }

  const providers = engine.listProviders();

  let defaultProvider = (process.env.DEFAULT_PROVIDER || '').trim().toLowerCase();
  if (defaultProvider && !engine.hasProvider(defaultProvider)) {
    logger.error(`DEFAULT_PROVIDER=${defaultProvider} is not registered. Available: ${formatProviders(providers)}`);
    defaultProvider = '';
  }

  if (!defaultProvider) {
    defaultProvider = providers.length === 1 ? providers[0]! : (engine.hasProvider('glm') ? 'glm' : providers[0]!);
  }

  const tools = [
    new ReadFileTool(),
    new WriteFileTool(),
    new RunCommandTool(),
    new ListDirectoryTool(),
    new FileSearchTool(),
    new ReplaceContentTool(),
    new SystemInfoTool(),
    new EchoTool(),
  ];

  // HITL Approval Handler using @inquirer/prompts
  const approvalHandler = async (description: string) => {
    logger.stopSpinner();
    const answer = await confirm({
      message: `[Security] ${description}. Allow?`,
      default: false,
    });
    return answer;
  };

  const security = new SecurityLayer(process.cwd(), approvalHandler);
  const memory = new MemoryManager(4000);
  const controller = new AgentController(engine, tools, defaultProvider, security, memory);

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
    telemetry.record(usage.provider, usage.inputTokens, usage.outputTokens);
    logger.tokenUsage(controller.getMemoryUsage(), telemetry, controller.getProviderName());
  });

  controller.on('onFinalAnswer', (ans) => {
    logger.answer(ans);
  });

  controller.on('onError', (err) => {
    logger.error(err.message || String(err));
  });

  logger.info(`Registered Providers: ${formatProviders(providers)} | Default: ${defaultProvider}`);

  return { controller, engine };
}

async function startREPL() {
  const { controller, engine } = await createAgent();

  console.log(require('chalk').bold.cyan('\n=== CodeAgent Interactive Mode ==='));
  console.log(require('chalk').dim('Type "exit" or "quit" to end the session.'));
  console.log(require('chalk').dim('Commands: /model [provider] to view/switch provider.\n'));

  while (true) {
    try {
      const line = await input({
        message: require('chalk').blue('CodeAgent >'),
      });

      if (!line || line.trim() === '') continue;
      const trimmed = line.trim();

      if (['exit', 'quit'].includes(trimmed.toLowerCase())) {
        logger.info('Goodbye!');
        process.exit(0);
      }

      // Runtime provider switch
      if (trimmed.startsWith('/model')) {
        const parts = trimmed.split(/\s+/).filter(Boolean);
        const providers = engine.listProviders();

        if (parts.length === 1) {
          logger.info(`Current Provider: ${controller.getProviderName()} | Available: ${formatProviders(providers)}`);
          continue;
        }

        const name = (parts[1] || '').trim().toLowerCase();
        if (!name) {
          logger.error(`Usage: /model <provider>. Available: ${formatProviders(providers)}`);
          continue;
        }

        if (!engine.hasProvider(name)) {
          logger.error(`Provider "${name}" is not registered. Available: ${formatProviders(providers)}`);
          continue;
        }

        controller.setProviderName(name);
        logger.info(`Switched provider to: ${name}`);
        continue;
      }

      await controller.run(trimmed);
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
