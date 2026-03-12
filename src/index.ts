#!/usr/bin/env ts-node
import * as dotenv from 'dotenv';
import * as readline from 'readline';

import { LLMEngine } from './llm/engine';
import { registerProvidersFromEnv } from './llm/register_providers';
import { AgentController } from './controller/agent_controller';
import { MemoryManager } from './controller/memory_manager';
import { SecurityLayer } from './controller/security_layer';
import { ContextInformer } from './controller/context_informer';
import { logger, TelemetryMonitor } from './utils/logger';

import { DefaultUIAdapter } from './cli/default_ui_adapter';
import { ToolBubbles } from './cli/tool_bubbles';
import { buildCompleter } from './cli/readline_completer';

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
import { SearchCodeTool } from './tools/search_code_tool';
import { FindDefinitionTool } from './tools/find_definition_tool';
import { ListTreeTool } from './tools/list_tree_tool';
import { UserSelectTool } from './tools/user_select_tool';
import { UserCheckboxTool } from './tools/user_checkbox_tool';
import { UserEditorTool } from './tools/user_editor_tool';

// Load environment variables
dotenv.config();

const telemetry = new TelemetryMonitor();

function formatProviders(list: string[]) {
  return list.length > 0 ? list.join(', ') : '(none)';
}

async function createAgent(ui: DefaultUIAdapter) {
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

  // HITL Approval Handler through UIAdapter
  const approvalHandler = async (description: string) => {
    logger.stopSpinner();
    return ui.confirmRisk(description);
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
    new SearchCodeTool(),
    new FindDefinitionTool(),
    new ListTreeTool(),
    new UserSelectTool(ui),
    new UserCheckboxTool(ui),
    new UserEditorTool(ui),
  ];

  // F6: Workspace Trust Check
  const isTrusted = await security.isWorkspaceTrusted();
  if (!isTrusted) {
    const root = process.cwd();
    console.log(`\n\x1b[33m[Security Warning]\x1b[0m Detect start in untrusted directory: \x1b[36m${root}\x1b[0m`);
    const answer = await ui.confirmRisk({
      type: 'security',
      level: 'MEDIUM',
      title: 'Trust workspace',
      detail: root,
      reason: 'Workspace not previously trusted',
    });

    if (!answer) {
      console.log('\x1b[31m[Security] Access denied. Exiting.\x1b[0m');
      process.exit(0);
    }
    await security.grantWorkspaceTrust();
    console.log('\x1b[32m[Security] Workspace authorized.\x1b[0m\n');
  }

  const memory = new MemoryManager(4000);
  const contextInformer = new ContextInformer();
  const bootSnapshot = await contextInformer.buildBootSnapshot(process.cwd());

  const controller = new AgentController(engine, tools, defaultProvider, security, memory, {
    systemPromptContext: { bootSnapshot },
    ui,
  });

  logger.info(`Registered Providers: ${formatProviders(providers)} | Default: ${defaultProvider}`);

  return { controller, engine, ui };
}

function renderFormattedOutput(fullResponse: string) {
  try {
    const marked = require('marked');
    const TerminalRenderer = require('marked-terminal');
    marked.setOptions({ renderer: new TerminalRenderer() });
    console.log('\n\n' + require('chalk').dim('--- Formatted Output ---'));
    console.log(marked.parse(fullResponse));
  } catch {
    console.log();
  }
}

async function startREPL() {
  const slashCommands = ['/model', '/clear', '/history', '/edit', '/tools', '/tool'];

  let inputSuspended = false;

  const bubbles = new ToolBubbles({ maxItems: 8, enabled: Boolean(process.stdout.isTTY) });

  const ui = new DefaultUIAdapter({
    suspendInput: async (fn) => {
      inputSuspended = true;
      try {
        return await fn();
      } finally {
        inputSuspended = false;
      }
    },
  });

  const { controller, engine } = await createAgent(ui);

  // Observability hooks
  controller.on('onThought', (text) => {
    logger.startSpinner('Thinking...');
    logger.thought(text);
  });

  controller.on('onToolStarted', (name, args) => {
    logger.stopSpinner();
    bubbles.onToolStarted(name, args);
  });

  controller.on('onToolFinished', (name, result) => {
    bubbles.onToolFinished(name, result);
  });

  controller.on('onCompletion', (usage) => {
    telemetry.record(usage.provider, usage.inputTokens, usage.outputTokens);
    logger.tokenUsage(controller.getMemoryUsage(), telemetry, controller.getProviderName());
  });

  controller.on('onError', (err) => {
    logger.error(err.message || String(err));
  });

  console.log(require('chalk').bold.cyan('\n=== CodeAgent Interactive Mode ==='));
  console.log(require('chalk').dim('Type "exit" or "quit" to end the session.'));
  console.log(require('chalk').dim('Commands: /model [provider], /clear, /history, /edit, /tools, /tool <id>'));
  console.log(require('chalk').dim('Multiline: type <<EOF then end with EOF'));
  console.log();

  const completer = buildCompleter({ cwd: process.cwd(), slashCommands });

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  let currentAbort: AbortController | null = null;

  const onKeypress = (_str: string, key: any) => {
    if (inputSuspended) return;
    if (!key) return;

    if (key.ctrl && key.name === 'l') {
      console.clear();
      controller.getMemory().clearHistory();
      bubbles.reset();
      logger.info('Session cleared.');
    }

    if (key.ctrl && key.name === 'c') {
      if (currentAbort) {
        currentAbort.abort();
      }
    }
  };

  process.stdin.on('keypress', onKeypress);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
  });

  let capturing = false;
  const captureLines: string[] = [];

  const question = (prompt: string) => {
    return new Promise<string>(resolve => rl.question(prompt, resolve));
  };

  while (true) {
    try {
      const promptText = capturing ? require('chalk').blue('... ') : require('chalk').blue('CodeAgent > ');
      const line = await question(promptText);

      if (!line && !capturing) continue;

      if (capturing) {
        if (line.trim() === 'EOF') {
          capturing = false;
          const text = captureLines.join('\n');
          captureLines.length = 0;
          if (!text.trim()) continue;
          await handleUserPrompt(text);
        } else {
          captureLines.push(line);
        }
        continue;
      }

      const trimmed = String(line || '').trim();
      if (!trimmed) continue;

      if (trimmed === '<<EOF' || trimmed === '<< EOF') {
        capturing = true;
        captureLines.length = 0;
        continue;
      }

      if (['exit', 'quit'].includes(trimmed.toLowerCase())) {
        logger.info('Goodbye!');
        process.exit(0);
      }

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

      if (trimmed === '/clear') {
        controller.getMemory().clearHistory();
        bubbles.reset();
        logger.info('Conversation history cleared.');
        continue;
      }

      if (trimmed === '/history') {
        const msgs = controller.getMemory().getMessages();
        logger.info(`History: ${msgs.length} messages (approx ${controller.getMemoryUsage()} tokens).`);
        continue;
      }

      if (trimmed === '/tools') {
        const items = bubbles.list();
        if (items.length === 0) {
          logger.info('No recent tools.');
        } else {
          console.log(items.map(i => `${i.id}: ${i.toolName} (${i.status})`).join('\n'));
        }
        continue;
      }

      if (trimmed.startsWith('/tool')) {
        const parts = trimmed.split(/\s+/).filter(Boolean);
        const id = Number(parts[1]);
        if (!Number.isFinite(id)) {
          logger.error('Usage: /tool <id>');
          continue;
        }
        const item = bubbles.getById(id);
        if (!item) {
          logger.error(`Tool id not found: ${id}`);
          continue;
        }
        console.log(require('chalk').dim(`\n--- Tool ${id}: ${item.toolName} ---`));
        console.log(require('chalk').dim('Args:'));
        console.log(JSON.stringify(item.args, null, 2));
        console.log(require('chalk').dim('\nResult:'));
        console.log(typeof item.result === 'string' ? item.result : JSON.stringify(item.result, null, 2));
        console.log(require('chalk').dim('--- End ---\n'));
        continue;
      }

      if (trimmed === '/edit') {
        const text = await ui.openEditor('Edit your prompt, then save and close:', '');
        if (text.trim()) {
          await handleUserPrompt(text);
        }
        continue;
      }

      await handleUserPrompt(trimmed);
    } catch (e: any) {
      if (e?.message?.includes('force closed')) {
        process.exit(0);
      }
      logger.error('Error during REPL: ' + (e?.message || String(e)));
    }
  }

  async function handleUserPrompt(prompt: string) {
    let firstChunkReceived = false;
    logger.startSpinner('Thinking...');

    let fullResponse = '';
    currentAbort = new AbortController();

    try {
      await controller.askStream(
        prompt,
        (chunk) => {
          if (!firstChunkReceived) {
            logger.stopSpinner();
            firstChunkReceived = true;
          }
          fullResponse += chunk;
          process.stdout.write(chunk);
        },
        { signal: currentAbort.signal }
      );

      if (!firstChunkReceived) {
        logger.stopSpinner();
      }

      renderFormattedOutput(fullResponse);
    } catch (err: any) {
      logger.stopSpinner();
      if (String(err?.message || '').toLowerCase().includes('aborted')) {
        console.log('\n' + require('chalk').yellow('[Interrupted]') + '\n');
        return;
      }
      throw err;
    } finally {
      currentAbort = null;
    }
  }
}

startREPL().catch(err => {
  logger.error('Fatal error: ' + (err?.message || String(err)));
  process.exit(1);
});
