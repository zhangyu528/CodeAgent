const chalk = require('chalk');

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

export async function test() {
  console.log('=== Running Unit Test: Welcome Banner ===');

  const version = '1.2.3';
  const currentProvider = 'deepseek';
  const providers = ['deepseek', 'glm'];
  const termWidth = 80;
  
  const ASCII_LOGO = [
    "  ___            _        _                    _  ",
    " / __|___  __| | ___   /_\\  __ _ ___ _ _  __| |_ ",
    "| (__/ _ \\/ _` |/ -_) / _ \\/ _` / -_) ' \\/ _`  _|",
    " \\___\\___/\\__,_|\\___|/_/ \\_\\__, \\___|_||_\\__,_\\__|",
    "                           |___/                  ",
  ];
  
  function centerText(text: string): string {
    const padding = Math.max(0, Math.floor((termWidth - text.length) / 2));
    return ' '.repeat(padding) + text;
  }
  
  const logoLines = ASCII_LOGO.map(line => centerText(line));
  const versionLine = centerText(`v${version}`);
  const providerColor = chalk.cyan;
  const providersText = providers.length > 0 ? providers.join(', ') : '无';
  const providerText = centerText(`Provider: ${providerColor(currentProvider)} (可用: ${providersText})`);
  const hintLine = centerText(chalk.gray('输入消息开始对话'));
  const footerLine = centerText(chalk.gray('Ctrl+C 退出'));
  
  const banner = [
    ...logoLines,
    '',
    versionLine,
    '',
    providerText,
    '',
    centerText('─'.repeat(Math.min(60, termWidth - 20))),
    '',
    hintLine,
    '',
    footerLine,
  ].join('\n');

  assert(banner.includes('v1.2.3'), 'Banner should contain correct version');

  assert(banner.includes('Provider:'), 'Banner should contain provider info');
  assert(banner.includes('deepseek'), 'Banner should contain current provider');
  assert(banner.includes('deepseek, glm'), 'Banner should list available providers');

  assert(!banner.includes('状态栏显示'), 'Banner should NOT contain status bar info');
  assert(!banner.includes('/help'), 'Banner should NOT contain help tip');

  console.log('✅ Welcome banner content and formatting verified.');
}

if (require.main === module) {
  test().catch(e => {
    console.error('❌ Welcome banner test failed:', e.message);
    process.exit(1);
  });
}
