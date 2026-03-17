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

function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

function centerText(text: string, width: number): string {
  const displayWidth = (s: string) => {
    let w = 0;
    for (const c of s) {
      const code = c.charCodeAt(0);
      w += (code > 127) ? 2 : 1;
    }
    return w;
  };
  const textWidth = displayWidth(text);
  const padding = Math.max(0, Math.floor((width - textWidth) / 2));
  return ' '.repeat(padding) + text;
}

const ASCII_LOGO = [
  "  ___            _        _                    _  ",
  " / __|___  __| | ___   /_\\  __ _ ___ _ _  __| |_ ",
  "| (__/ _ \\/ _` |/ -_) / _ \\/ _` / -_) ' \\/ _`  _|",
  " \\___\\___/\\__,_|\\___|/_/ \\_\\__, \\___|_||_\\__,_\\__|",
  "                           |___/                  ",
];

export function renderWelcomeCard(opts: { version: string; provider: string; providers: string[] }): string {
  const termWidth = getTerminalWidth();
  const termHeight = process.stdout.rows || 24;
  
  const logoLines = ASCII_LOGO.map(line => centerText(line, termWidth));
  
  const versionLine = centerText(`v${opts.version}`, termWidth);
  
  const isBuiltIn = opts.provider.includes('内置免费');
  const providersText = opts.providers.length > 0 ? opts.providers.join(', ') : '无';
  const providerText = `Provider: ${opts.provider} (可用: ${providersText})`;
  const providerInfo = centerText(providerText, termWidth);
  const coloredProviderInfo = isBuiltIn 
    ? providerInfo.replace(opts.provider, chalk.green(opts.provider))
    : providerInfo.replace(opts.provider, chalk.cyan(opts.provider));
  
  const contentLines = [
    ...logoLines,
    '',
    versionLine,
    '',
    coloredProviderInfo,
  ];
  
  const totalContentHeight = contentLines.length;
  const topPadding = Math.max(0, Math.floor((termHeight - totalContentHeight) / 2));
  const bottomPadding = Math.max(0, termHeight - totalContentHeight - topPadding);
  
  return [
    '\n'.repeat(topPadding),
    ...contentLines,
    '\n'.repeat(bottomPadding),
  ].join('\n');
}
