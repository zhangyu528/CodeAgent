import blessed from 'blessed';

export interface WelcomeData {
  provider: string;
  providers: string[];
}

const ASCII_LOGO = [
  "  ___            _        _                    _  ",
  " / __|___  __| | ___   /_\\  __ _ ___ _ _  __| |_ ",
  "| (__/ _ \\/ _` |/ -_) / _ \\/ _` / -_) ' \\/ _`  _|",
  " \\___\\___/\\__,_|\\___|/_/ \\_\\__, \\___|_||_\\__,_\\__|",
  "                           |___/                  ",
];

function getCliVersion(): string {
  try {
    const pkg = require('../../../package.json') as { version?: string };
    const v = String(pkg?.version || '').trim();
    return v || 'dev';
  } catch {
    return 'dev';
  }
}

export class BlessedWelcome {
  private screen: ReturnType<typeof blessed.screen>;

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'CodeAgent CLI',
    });
  }

  render(data: WelcomeData, onSubmit: (input: string) => void) {
    const version = getCliVersion();
    
    const isBuiltIn = data.provider.includes('内置免费');
    
    // Main Container for vertical centering
    const container = blessed.box({
      top: 'center',
      left: 'center',
      width: '80%',
      height: 25,
      style: {
        bg: 'black',
        fg: 'white',
      },
    });

    // Logo区域
    const logoBox = blessed.box({
      parent: container,
      top: 0,
      left: 'center',
      width: '100%',
      height: 12,
      content: this.buildLogoContent(version, data, isBuiltIn),
      tags: true,
      align: 'center',
      style: {
        fg: 'white',
        bg: 'black',
      },
    });

    // 分隔线
    const divider = blessed.line({
      parent: container,
      top: 12,
      left: 'center',
      width: '100%',
      orientation: 'horizontal',
      style: {
        fg: 'gray',
        bg: 'black',
      },
    });

    // 输入提示说明
    const instructionBox = blessed.box({
      parent: container,
      top: 14,
      left: 'center',
      width: '100%',
      height: 1,
      content: '{gray-fg}输入消息开始对话，或按 Enter 开始{/}',
      tags: true,
      align: 'center',
      style: {
        fg: 'gray',
        bg: 'black',
      },
    });

    // 输入区域容器
    const inputContainer = blessed.box({
      parent: container,
      top: 16,
      left: 'center',
      width: '80%',
      height: 3,
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          type: 'line',
          fg: 'cyan',
        },
      },
    });

    // 输入提示符
    const prompt = blessed.box({
      parent: inputContainer,
      top: 0,
      left: 1,
      width: 2,
      content: '{cyan-fg}❯{/}',
      tags: true,
      style: {
        fg: 'cyan',
        bg: 'black',
      },
    });

    // 输入框
    const inputBox = blessed.textbox({
      parent: inputContainer,
      top: 0,
      left: 3,
      width: '100%-5',
      height: 1,
      tags: true,
      style: {
        fg: 'white',
        bg: 'black',
        focus: {
          fg: 'cyan',
          bg: 'black',
        },
      },
      inputOnFocus: true,
    });

    // 底部提示
    const footerBox = blessed.box({
      parent: container,
      top: 20,
      left: 'center',
      width: '100%',
      height: 1,
      content: '{gray-fg}Ctrl+C 退出{/}',
      tags: true,
      align: 'center',
      style: {
        fg: 'gray',
        bg: 'black',
      },
    });

    this.screen.append(container);
    
    inputBox.focus();
    this.screen.render();

    inputBox.on('submit', (value: string) => {
      onSubmit(value);
    });

    this.screen.key('enter', () => {
      const value = inputBox.getValue();
      if (value.trim()) {
        onSubmit(value);
      } else {
        onSubmit('');
      }
    });

    this.screen.key(['C-c', 'q', 'C-d'], () => {
      process.exit(0);
    });
  }

  private buildLogoContent(version: string, data: WelcomeData, isBuiltIn: boolean): string {
    const logo = ASCII_LOGO.join('\n');
    const providerColor = isBuiltIn ? 'green' : 'cyan';
    const providersText = data.providers.length > 0 ? data.providers.join(', ') : '无';
    
    const lines = [
      '',
      logo,
      '',
      `{bold}v${version}{/bold}`,
      '',
      `{${providerColor}-fg}Provider:{/} ${data.provider} (可用: ${providersText})`,
    ];
    return lines.join('\n');
  }

  destroy() {
    this.screen.destroy();
  }
}

export function isBlessedSupported(): boolean {
  const isDumb = process.env.TERM === 'dumb';
  const hasValidTerm = process.env.TERM && process.env.TERM !== 'dumb';
  return Boolean(hasValidTerm);
}
