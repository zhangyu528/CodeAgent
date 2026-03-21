import chalk from 'chalk';
export type SlashHandlerResult = { handled: boolean; error?: string };

export type SlashCommandDef = {
  name: string;
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
      description: 'Show command help and keybindings.',
      category: 'General',
      handler: async (ctx) => {
        const lines = buildHelpLines(ctx);
        ctx.print(lines.join('\n'));
      },
    },
    {
      name: '/new',
      usage: '/new',
      description: '保存当前会话并返回欢迎页（欢迎页输入内容回车可新建）',
      category: 'Session',
      handler: async (ctx) => {
        if (ctx.getPageState?.() === 'chat') {
          if (ctx.isStreaming?.()) {
            ctx.abortStreaming?.();
          }
          ctx.controller.endCurrentSession?.();
          ctx.returnToWelcome?.();
          return;
        }
        ctx.info('已在欢迎页，输入内容后回车即可新建会话。');
      },
    },
    {
      name: '/history',
      usage: '/history',
      description: '查看最近会话列表',
      category: 'Session',
      handler: async (ctx) => {
        const rows = ctx.controller.listRecentSessions(10);
        if (!rows.length) {
          ctx.info('暂无历史会话。');
          return;
        }
        const lines = rows.map((s: any, idx: number) => `${idx + 1}. ${s.title} [${s.status}] ${s.provider}/${s.model} ${s.updatedAt}`);
        ctx.print(lines.join('\n'));
      },
    },
    {
      name: '/resume',
      usage: '/resume',
      description: '恢复最近一次会话',
      category: 'Session',
      handler: async (ctx, args) => {
        // InkApp 中会拦截并执行恢复逻辑；这里做参数兜底提示。
        if (args.length > 0) ctx.info('Usage: /resume');
        else ctx.info('正在恢复最近一次会话...');
      },
    },
    {
      name: '/exit',
      usage: '/exit',
      description: '结束当前会话并退出',
      category: 'Session',
      handler: async (ctx) => {
        await ctx.requestExit?.();
      },
    },
    {
      name: '/model',
      usage: '/model',
      description: '交互式切换当前 Provider 的模型',
      category: 'Model',
      handler: async (ctx) => {
        const models = await ctx.controller.listModels();
        if (models.length === 0) {
          ctx.info(chalk.yellow('当前 Provider 不支持在线列出模型，或获取失败。'));
          const manual = await ctx.ui.ask('请输入模型名称:');
          if (manual) {
            ctx.controller.setModel(manual);
            ctx.info(chalk.green(`已切换模型为: ${manual}`));
          }
          return;
        }

        const current = ctx.controller.getModelName();
        const selected = await ctx.ui.selectOne(`请选择模型 (当前: ${current}):`, models, {
          default: current,
        });

        ctx.controller.setModel(selected);
        ctx.info(chalk.green(`已切换模型为: ${selected}`));
      },
    },
    {
      name: '/provider',
      usage: '/provider',
      description: '交互式切换 AI 服务商',
      category: 'Model',
      handler: async (ctx) => {
        const providers = ctx.engine.listProviders();
        const current = ctx.controller.getProviderName();

        const selected = await ctx.ui.selectOne(`请选择 Provider (当前: ${current}):`, providers, {
          default: current,
        });

        if (selected !== current) {
          ctx.controller.switchProvider(selected);
          ctx.info(chalk.green(`已切换 Provider 为: ${selected}`));
          ctx.info(chalk.dim(`当前模型: ${ctx.controller.getModelName()}`));
        }
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

  if (selectedHint && selectedHint.startsWith(parsed.name)) {
    return selectedHint;
  }

  let cmd = commands.find(c => c.name === parsed.name);
  if (!cmd) {
    const matches = commands.filter(c => c.name.startsWith(parsed.name));
    if (matches.length > 0) cmd = matches[0];
  }

  return cmd ? cmd.name : parsed.name;
}

function renderOutputSidebar(ctx: any, _title: string, lines: string[]): void {
  ctx.print('');
  for (const line of lines) {
    ctx.print(`  ${chalk.cyan('┃')} ${line}`);
  }
  ctx.print('');
}

export async function dispatchSlash(
  ctx: any,
  line: string,
  commands: SlashCommandDef[],
  selectedItem: string | null = null
): Promise<boolean> {
  const parsed = parseSlash(line);
  if (!parsed) return false;

  if (!Array.isArray(commands)) {
    ctx.error('命令系统参数异常，请重试。');
    return true;
  }

  const cmdName = getBestMatch(line, commands, selectedItem);
  const cmd = commands.find((c) => c.name === cmdName);

  if (!cmd) {
    ctx.error(`未知命令: ${parsed.name}。输入 /help 查看帮助。`);
    return true;
  }

  try {
    if (cmd.name === '/help') {
      renderOutputSidebar(ctx, '/help', buildHelpLines(ctx));
    } else {
      await cmd.handler(ctx, parsed.args);
    }
  } catch (e: any) {
    ctx.error(e?.message || String(e));
  }

  return true;
}

export function buildHelpLines(ctx: any): string[] {
  const cmds: SlashCommandDef[] = Array.isArray(ctx.commands) ? ctx.commands : [];

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
    `  ${chalk.cyan('Esc'.padEnd(10))} ${chalk.dim('取消当前操作 / 关闭命令面板或选择框')}`,
    `  ${chalk.cyan('Ctrl+C'.padEnd(10))} ${chalk.dim('中断任务；空闲时退出')}`,
    `  ${chalk.cyan('Ctrl+D'.padEnd(10))} ${chalk.dim('退出程序')}`,
    `  ${chalk.cyan('Ctrl+L'.padEnd(10))} ${chalk.dim('清空输出区域')}`,
    `  ${chalk.cyan('↑/↓'.padEnd(10))} ${chalk.dim('在命令候选或选择框中移动')}`,
    `  ${chalk.cyan('Enter'.padEnd(10))} ${chalk.dim('确认候选/确认选择')}`,
    `  ${chalk.cyan('Tab'.padEnd(10))} ${chalk.dim('补全当前命令候选')}`,
  ];

  results.push(...keys);
  return results;
}
