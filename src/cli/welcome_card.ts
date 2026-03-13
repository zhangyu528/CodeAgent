import chalk = require('chalk');

export function getCliVersion(): string {
  try {
    const pkg = require('../../package.json') as { version?: string };
    const v = String(pkg?.version || '').trim();
    return v || 'dev';
  } catch {
    return 'dev';
  }
}

export function renderWelcomeCard(opts: { version: string; provider: string; providers: string[] }): string {
  const leftRaw = ['  ▝▜▄', '    ▝▜▄', '   ▗▟▀', '  ▝▀'];
  const leftWidth = Math.max(...leftRaw.map(s => s.length));

  const leftColored = [
    chalk.dim.cyan(leftRaw[0]),
    chalk.cyan(leftRaw[1]),
    chalk.green(leftRaw[2]),
    chalk.greenBright(leftRaw[3]),
  ].map((s, idx) => s + ' '.repeat(leftWidth - leftRaw[idx]!.length));

  const providersText = opts.providers.length > 0 ? opts.providers.join(', ') : '无';
  const right = [
    chalk.cyan.bold(`CodeAgent CLI v${opts.version}`),
    '',
    chalk.cyan(`Provider: ${opts.provider} (可用: ${providersText})`),
  ];

  return leftColored.map((l, i) => `${l}  ${right[i] ?? ''}`).join('\n') + '\n';
}
