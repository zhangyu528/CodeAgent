export type SlashHandlerResult = { handled: boolean; error?: string };

export type SlashCommandDef = {
  name: string; // e.g. /help
  usage: string;
  description: string;
  category: 'Session' | 'Model' | 'Tools' | 'General';
  handler: (ctx: any, args: string[]) => Promise<void>;
};

export function getDefaultSlashCommands(): SlashCommandDef[] {
  return [
    {
      name: '/help',
      usage: '/help',
      description: 'Show command help and configuration hints.',
      category: 'General',
      handler: async (ctx) => {
        const lines = buildHelpLines(ctx);
        ctx.print(lines.join('\n'));
      },
    },
    {
      name: '/model',
      usage: '/model',
      description: '交互式切换当前 Provider 的模型',
      category: 'Model',
      handler: async (ctx) => {
        const chalk = require('chalk');
        const models = await ctx.controller.listModels();
        if (models.length === 0) {
          ctx.info(chalk.yellow('当前 Provider 不支持在线列出模型，或获取失败。'));
          const { input } = require('@inquirer/prompts');
          const manual = await input({ message: '请输入模型名称:' });
          if (manual) {
            ctx.controller.setModel(manual);
            ctx.info(chalk.green(`已切换模型为: ${manual}`));
            ctx.hud?.render();
          }
          return;
        }

        const current = ctx.controller.getModelName();
        const { select } = require('@inquirer/prompts');
        const selected = await select({
          message: `请选择模型 (当前: ${current}):`,
          choices: models.map((m: string) => ({ name: m, value: m })),
        });

        ctx.controller.setModel(selected);
        ctx.info(chalk.green(`已切换模型为: ${selected}`));
        ctx.hud?.render();
      },
    },
    {
      name: '/provider',
      usage: '/provider',
      description: '交互式切换 AI 服务商',
      category: 'Model',
      handler: async (ctx) => {
        const chalk = require('chalk');
        const providers = ctx.engine.listProviders();
        const current = ctx.controller.getProviderName();
        
        const { select } = require('@inquirer/prompts');
        const selected = await select({
          message: `请选择 Provider (当前: ${current}):`,
          choices: providers.map((p: string) => ({ name: p, value: p })),
        });

        if (selected !== current) {
          ctx.controller.switchProvider(selected);
          ctx.info(chalk.green(`已切换 Provider 为: ${selected}`));
          ctx.info(chalk.dim(`当前模型: ${ctx.controller.getModelName()}`));
          ctx.hud?.setProvider(selected);
          ctx.hud?.render();
        }
      },
    },
    {
      name: '/clear',
      usage: '/clear',
      description: 'Clear conversation memory (and tool bubbles).',
      category: 'Session',
      handler: async (ctx) => {
        ctx.controller.getMemory().clearHistory();
        ctx.bubbles.reset();
        ctx.hud?.setContextTokens(ctx.controller.getMemoryUsage());
        ctx.hud?.setBubbleLines(ctx.bubbles.getLines());
        ctx.hud?.render();
        ctx.info('Conversation history cleared.');
      },
    },
    {
      name: '/history',
      usage: '/history',
      description: 'Show message count and approximate context tokens.',
      category: 'Session',
      handler: async (ctx) => {
        const msgs = ctx.controller.getMemory().getMessages();
        ctx.info(`History: ${msgs.length} messages (approx ${ctx.controller.getMemoryUsage()} tokens).`);
      },
    },
    {
      name: '/tools',
      usage: '/tools',
      description: 'List recent tools (id/name/status).',
      category: 'Tools',
      handler: async (ctx) => {
        const items = ctx.bubbles.list();
        if (items.length === 0) {
          ctx.info('No recent tools.');
          return;
        }
        ctx.print(items.map((i: any) => `${i.id}: ${i.toolName} (${i.status})`).join('\n'));
      },
    },
    {
      name: '/tool',
      usage: '/tool <id>',
      description: 'Inspect a tool call by id (args + result).',
      category: 'Tools',
      handler: async (ctx, args) => {
        const id = Number(args[0]);
        if (!Number.isFinite(id)) {
          ctx.error('Usage: /tool <id>');
          return;
        }
        const item = ctx.bubbles.getById(id);
        if (!item) {
          ctx.error(`Tool id not found: ${id}`);
          return;
        }
        const chalk = require('chalk');
        ctx.print(chalk.dim(`\n--- Tool ${id}: ${item.toolName} ---`));
        ctx.print(chalk.dim('Args:'));
        ctx.print(JSON.stringify(item.args, null, 2));
        ctx.print(chalk.dim('\nResult:'));
        ctx.print(typeof item.result === 'string' ? item.result : JSON.stringify(item.result, null, 2));
        ctx.print(chalk.dim('--- End ---\n'));
      },
    },
    {
      name: '/edit',
      usage: '/edit',
      description: 'Open editor to compose a prompt (TTY only).',
      category: 'General',
      handler: async (ctx) => {
        const text = await ctx.ui.openEditor('Edit your prompt, then save and close:', '');
        if (String(text || '').trim()) {
          await ctx.handleUserPrompt(text);
        }
      },
    },
  ];
}

export function parseSlash(line: string): { name: string; args: string[] } | null {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('/')) return null;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  return { name: parts[0]!, args: parts.slice(1) };
}

export async function dispatchSlash(ctx: any, line: string, commands: SlashCommandDef[]): Promise<boolean> {
  const parsed = parseSlash(line);
  if (!parsed) return false;

  const cmd = commands.find(c => c.name === parsed.name);
  if (!cmd) {
    ctx.error(`Unknown command: ${parsed.name}. Try /help`);
    return true;
  }

  try {
    await cmd.handler(ctx, parsed.args);
  } catch (e: any) {
    ctx.error(e?.message || String(e));
  }
  return true;
}

export function buildHelpLines(ctx: any): string[] {
  const chalk = require('chalk');
  const cmds: SlashCommandDef[] = ctx.commands;

  const header = chalk.bold.cyan('Commands');
  const rows = cmds
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c: SlashCommandDef) => {
      const left = chalk.yellow(c.usage.padEnd(18));
      return `  ${left} ${chalk.dim(c.description)}`;
    });

  const config = [
    chalk.bold.cyan('Config'),
    `  ${chalk.yellow('STATUS_BAR=0|1'.padEnd(18))} ${chalk.dim('Toggle status bar (TTY default on).')}`,
    `  ${chalk.yellow('TOOL_BUBBLES=0|1'.padEnd(18))} ${chalk.dim('Toggle tool bubbles (TTY default on).')}`,
    `  ${chalk.yellow('NO_COLOR=1'.padEnd(18))} ${chalk.dim('Disable colored output.')}`,
    `  ${chalk.yellow('DEFAULT_PROVIDER'.padEnd(18))} ${chalk.dim('Startup provider selection.')}`,
    `  ${chalk.yellow('DIFF_CONFIRM'.padEnd(18))} ${chalk.dim('Diff confirmation mode: smart/always/off.')}`,
  ];

  const keys = [
    chalk.bold.cyan('Keys (TTY)'),
    `  ${chalk.yellow('Ctrl+C'.padEnd(18))} ${chalk.dim('Interrupt streaming/thinking; cancel capture.')}`,
    `  ${chalk.yellow('Ctrl+D'.padEnd(18))} ${chalk.dim('Exit.')}`,
    `  ${chalk.yellow('Ctrl+L'.padEnd(18))} ${chalk.dim('Clear screen (keep session).')}`,
    `  ${chalk.yellow('Tab'.padEnd(18))} ${chalk.dim('Autocomplete commands/paths (/model providers).')}`,
    `  ${chalk.yellow('Up/Down'.padEnd(18))} ${chalk.dim('Navigate input history.')}`,
  ];

  return [header, ...rows, '', ...config, '', ...keys];
}
