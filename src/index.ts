import * as dotenv from 'dotenv';
import * as readline from 'readline';
import chalk = require('chalk');

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
import { HUD } from './cli/hud';
import { attachKeybindings } from './cli/keybindings';
import { dispatchSlash, getDefaultSlashCommands } from './cli/slash_commands';
import { runInitWizard } from './cli/setup_wizard';
import { getCliVersion, renderWelcomeCard } from './cli/welcome_card';

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
dotenv.config({ quiet: true });

const telemetry = new TelemetryMonitor();

function envEnabled(name: string, defaultOn: boolean) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return defaultOn;
  if (raw === '0' || raw.toLowerCase() === 'false' || raw.toLowerCase() === 'off') return false;
  if (raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'on') return true;
  return defaultOn;
}

function formatProviders(list: string[]) {
  return list.length > 0 ? list.join(', ') : '(none)';
}

async function createAgent(ui: DefaultUIAdapter) {
  const engine = new LLMEngine();

  let reg = registerProvidersFromEnv(engine);
  if (reg.registered.length === 0) {
    const success = await runInitWizard();
    if (success) {
      // Reload env again
      dotenv.config({ quiet: true });
      reg = registerProvidersFromEnv(engine);
    }

    if (reg.registered.length === 0) {
      logger.error('No LLM providers configured. Please set provider env vars in .env.');
      if (reg.skipped.length > 0) {
        logger.info(`Skipped: ${reg.skipped.map(s => `${s.name}(${s.reason})`).join(' | ')}`);
      }
      process.exit(1);
    }
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
  const hud = new HUD();
  await hud.init();

  const bubblesEnabled = Boolean(process.stdout.isTTY) && envEnabled('TOOL_BUBBLES', true);
  const bubbles = new ToolBubbles({ maxItems: 8, enabled: bubblesEnabled });

  let rl: readline.Interface | null = null;
  let inputSuspended = false;
  let capturing = false;
  const captureLines: string[] = [];
  let currentAbort: AbortController | null = null;

  const ui = new DefaultUIAdapter({
    suspendInput: async (fn) => {
      inputSuspended = true;
      const prevMode = hud.getMode();
      hud.setMode('CONFIRM');
      hud.setBubbleLines(bubbles.getLines());
      hud.setLastTool(bubbles.getLastLabel());
      hud.render({ includeBubbles: true });

      // Pause readline + raw mode so inquirer can safely read stdin.
      try {
        rl?.pause();
      } catch {
        // ignore
      }
      if (process.stdin.isTTY) {
        try { process.stdin.setRawMode(false); } catch { /* ignore */ }
      }

      try {
        return await fn();
      } finally {
        if (process.stdin.isTTY) {
          try { process.stdin.setRawMode(true); } catch { /* ignore */ }
        }
        try {
          rl?.resume();
        } catch {
          // ignore
        }
        inputSuspended = false;
        hud.setMode(prevMode);
        hud.render({ includeBubbles: true });
        try {
          rl?.prompt(true);
        } catch {
          // ignore
        }
      }
    },
  });

  const { controller, engine } = await createAgent(ui);

  const commands = getDefaultSlashCommands();
  const slashNames = commands.map(c => c.name);

  // Observability hooks
  controller.on('onThought', (_text) => {
    hud.setMode('THINKING');
    hud.setContextTokens(controller.getMemoryUsage());
    hud.setTelemetry(telemetry.getSummary() as any);
    hud.setLastTool(bubbles.getLastLabel());
    hud.setBubbleLines(bubbles.getLines());
    hud.render({ includeBubbles: true });

    logger.startSpinner('Thinking...');
  });

  controller.on('onToolStarted', (name, args) => {
    logger.stopSpinner();
    bubbles.onToolStarted(name, args);
    hud.setLastTool(bubbles.getLastLabel());
    hud.setBubbleLines(bubbles.getLines());
    hud.render({ includeBubbles: true });
  });

  controller.on('onToolFinished', (name, result) => {
    bubbles.onToolFinished(name, result);
    hud.setLastTool(bubbles.getLastLabel());
    hud.setBubbleLines(bubbles.getLines());
    hud.render({ includeBubbles: true });
  });

  controller.on('onCompletion', (usage) => {
    telemetry.record(usage.provider, usage.inputTokens, usage.outputTokens);
    hud.setTelemetry(telemetry.getSummary() as any);
    hud.setContextTokens(controller.getMemoryUsage());
    hud.setLastTool(bubbles.getLastLabel());
    hud.setBubbleLines(bubbles.getLines());
    hud.render({ includeBubbles: true });

    logger.tokenUsage(controller.getMemoryUsage(), telemetry, controller.getProviderName());
  });

  controller.on('onError', (err) => {
    logger.error(err.message || String(err));
  });

  // Welcome
  console.log(
    renderWelcomeCard({
      version: getCliVersion(),
      provider: controller.getProviderName(),
      providers: engine.listProviders(),
    }),
  );

  hud.setProvider(controller.getProviderName());
  hud.setMode('IDLE');
  hud.setContextTokens(controller.getMemoryUsage());
  hud.setTelemetry(telemetry.getSummary() as any);
  hud.setLastTool(bubbles.getLastLabel());
  hud.setBubbleLines(bubbles.getLines());
  hud.render({ includeBubbles: true });

  const completer = buildCompleter({
    cwd: process.cwd(),
    slashCommands: slashNames,
    getModelProviders: () => engine.listProviders(),
  });

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
    historySize: 1000,
  });

  const refreshPrompt = () => {
    rl!.setPrompt(capturing ? require('chalk').blue('... ') : require('chalk').blue('CodeAgent > '));
  };

  const keybindings = attachKeybindings({
    rl,
    isTTY: Boolean(process.stdin.isTTY),
    getMode: () => hud.getMode() as any,
    isInputSuspended: () => inputSuspended,
    isCapturing: () => capturing,
    cancelCapture: () => {
      capturing = false;
      captureLines.length = 0;
      hud.setMode('IDLE');
      hud.setBubbleLines(bubbles.getLines());
      hud.setLastTool(bubbles.getLastLabel());
      hud.render({ includeBubbles: true });
      refreshPrompt();
      rl!.prompt(true);
    },
    abortCurrent: () => {
      const mode = hud.getMode();
      if ((mode === 'STREAMING' || mode === 'THINKING') && currentAbort) {
        currentAbort.abort();
        return true;
      }
      return false;
    },
    onClearScreen: () => {
      console.clear();
      hud.render({ includeBubbles: true });
      rl!.prompt(true);
    },
    onExit: () => {
      logger.info('Goodbye!');
      keybindings.detach();
      try { rl!.close(); } catch { /* ignore */ }
      process.exit(0);
    },
    onHint: (text) => {
      logger.info(text);
    },
  });

  refreshPrompt();
  rl.prompt();

  let processing = false;

  const ctx: any = {
    controller,
    engine,
    ui,
    bubbles,
    hud,
    commands,
    info: (m: string) => logger.info(m),
    error: (m: string) => logger.error(m),
    print: (t: string) => console.log(t),
    handleUserPrompt: async (_t: string) => {},
  };

  const handleUserPrompt = async (prompt: string) => {
    let firstChunkReceived = false;
    let fullResponse = '';

    hud.setMode('THINKING');
    hud.setContextTokens(controller.getMemoryUsage());
    hud.setLastTool(bubbles.getLastLabel());
    hud.setBubbleLines(bubbles.getLines());
    hud.render({ includeBubbles: true });

    logger.startSpinner('Thinking...');

    currentAbort = new AbortController();

    // Avoid cursor-control interleaving during streaming output
    hud.suspend(true);

    try {
      await controller.askStream(
        prompt,
        (chunk) => {
          if (!firstChunkReceived) {
            logger.stopSpinner();
            hud.setMode('STREAMING');
            firstChunkReceived = true;
          }
          fullResponse += chunk;
          process.stdout.write(chunk);
        },
        { signal: currentAbort!.signal }
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
      hud.suspend(false);
      hud.setMode('IDLE');
      hud.setContextTokens(controller.getMemoryUsage());
      hud.setTelemetry(telemetry.getSummary() as any);
      hud.setLastTool(bubbles.getLastLabel());
      hud.setBubbleLines(bubbles.getLines());
      hud.render({ includeBubbles: true });
    }
  };

  ctx.handleUserPrompt = handleUserPrompt;

  rl.on('line', async (line) => {
    if (processing) return;
    processing = true;

    try {
      const raw = String(line || '');
      const trimmed = raw.trim();

      if (!trimmed && !capturing) {
        return;
      }

      // Capture mode
      if (capturing) {
        if (trimmed === 'EOF') {
          capturing = false;
          const text = captureLines.join('\n');
          captureLines.length = 0;
          if (text.trim()) {
            await handleUserPrompt(text);
          }
        } else {
          captureLines.push(raw);
        }
        return;
      }

      if (trimmed === '<<EOF' || trimmed === '<< EOF') {
        capturing = true;
        captureLines.length = 0;
        hud.setMode('CAPTURE');
        hud.render({ includeBubbles: true });
        return;
      }

      if (['exit', 'quit'].includes(trimmed.toLowerCase())) {
        logger.info('Goodbye!');
        keybindings.detach();
        rl!.close();
        process.exit(0);
      }

      // Slash commands
      const handled = await dispatchSlash(ctx, trimmed, commands);
      if (handled) {
        return;
      }

      // If it looks like a slash command but not recognized, dispatchSlash already handled.
      await handleUserPrompt(trimmed);
    } catch (e: any) {
      logger.error('Error during REPL: ' + (e?.message || String(e)));
    } finally {
      processing = false;
      hud.setProvider(controller.getProviderName());
      hud.setMode(capturing ? 'CAPTURE' : 'IDLE');
      hud.setContextTokens(controller.getMemoryUsage());
      hud.setTelemetry(telemetry.getSummary() as any);
      hud.setLastTool(bubbles.getLastLabel());
      hud.setBubbleLines(bubbles.getLines());
      hud.render({ includeBubbles: true });

      refreshPrompt();
      rl!.prompt();
    }
  });

  rl.on('close', () => {
    keybindings.detach();
    process.exit(0);
  });
}

startREPL().catch(err => {
  logger.error('Fatal error: ' + (err?.message || String(err)));
  process.exit(1);
});

