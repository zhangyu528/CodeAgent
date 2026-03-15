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
  ];
}

export function parseSlash(line: string): { name: string; args: string[] } | null {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('/')) return null;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { name: '/', args: [] };
  return { name: parts[0]!, args: parts.slice(1) };
}

export function getBestMatch(line: string, commands: SlashCommandDef[], selectedHint?: string | null): string {
  const parsed = parseSlash(line);
  if (!parsed) return line;

  let cmdName = parsed.name;
  // Priority 1: Use selected hint if it matches the prefix
  if (selectedHint && selectedHint.startsWith(parsed.name)) {
    return selectedHint;
  }

  // Priority 2: Use exact match or best fuzzy match
  let cmd = commands.find(c => c.name === cmdName);
  if (!cmd) {
    const matches = commands.filter(c => c.name.startsWith(cmdName));
    if (matches.length > 0) {
      cmd = matches[0];
    }
  }

  return cmd ? cmd.name : cmdName;
}

export async function dispatchSlash(ctx: any, line: string, commands: SlashCommandDef[], selectedHint?: string | null): Promise<boolean> {
  const parsed = parseSlash(line);
  if (!parsed) return false;

  const cmdName = getBestMatch(line, commands, selectedHint);
  const cmd = commands.find(c => c.name === cmdName);

  if (!cmd) {
    ctx.error(`未知命令: ${parsed.name}。输入 /help 查看帮助。`);
    return true;
  }

  try {
    if (cmd.name === '/help') {
      const helpLines = buildHelpLines(ctx);
      renderOutputBox(ctx, '/help (Result)', helpLines);
    } else {
      await cmd.handler(ctx, parsed.args);
    }
  } catch (e: any) {
    ctx.error(e?.message || String(e));
  }
  return true;
}

export function renderOutputBox(ctx: any, title: string, content: string[]) {
  const chalk = require('chalk');
  const termWidth = process.stdout.columns || 80;
  const boxWidth = Math.min(termWidth - 4, 80);
  
  const topBar = chalk.cyan('┌── ') + chalk.bold.cyan(title) + ' ' + chalk.cyan('─'.repeat(Math.max(0, boxWidth - title.length - 6)) + '┐');
  const bottomBar = chalk.cyan('└' + '─'.repeat(boxWidth - 2) + '┘');

  ctx.print(topBar);
  for (const line of content) {
    // Strip ANSI for alignment calculation
    const cleanLine = line.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    const padding = Math.max(0, boxWidth - 4 - cleanLine.length);
    ctx.print(chalk.cyan('│ ') + line + ' '.repeat(padding) + chalk.cyan(' │'));
  }
  ctx.print(bottomBar);
}

export function buildHelpLines(ctx: any): string[] {
  const chalk = require('chalk');
  const cmds: SlashCommandDef[] = ctx.commands;

  const results: string[] = [];
  results.push(chalk.bold.cyan('可用命令'));
  
  const rows = cmds
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c: SlashCommandDef) => {
      const cmdPart = chalk.cyan(c.name.padEnd(10));
      const usagePart = chalk.dim(c.usage.replace(c.name, '').trim());
      const left = usagePart ? `${cmdPart} ${usagePart}`.padEnd(20) : cmdPart.padEnd(20);
      return `  ${left} ${chalk.dim(c.description)}`;
    });
  
  results.push(...rows, '');
  results.push(chalk.bold.cyan('常用快捷键'));
  
  const keys = [
    `  ${chalk.cyan('Esc'.padEnd(10))} ${chalk.dim('取消当前操作 / 清空输入')}`,
    `  ${chalk.cyan('Ctrl+C'.padEnd(10))} ${chalk.dim('中断任务 / 取消录制')}`,
    `  ${chalk.cyan('Ctrl+D'.padEnd(10))} ${chalk.dim('退出程序')}`,
    `  ${chalk.cyan('↑/↓'.padEnd(10))} ${chalk.dim('选择建议 / 历史记录')}`,
  ];
  
  results.push(...keys);
  return results;
}
