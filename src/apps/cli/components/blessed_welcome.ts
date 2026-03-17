import blessed from 'blessed';
import { getCliVersion } from './welcome_card';

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
    
    // Logo
    const logo = ASCII_LOGO.join('\n');
    
    // 计算logo的高度
    const logoLines = ASCII_LOGO.length;
    
    const lines = [
      '',
      logo,
      '',
      `v${version}`,
      '',
      `Provider: ${data.provider} (Available: ${data.providers.join(', ')})`,
    ];

    const content = lines.join('\n');

    // 主容器 - 在上半部分
    const container = blessed.box({
      top: 0,
      left: 'center',
      width: '100%',
      height: '50%',
      content: content,
      style: {
        fg: 'white',
        bg: 'black',
      },
    });

    // 输入框 - 在中间位置
    const inputBox = blessed.textbox({
      top: '50%',
      left: 'center',
      width: '80%',
      height: 3,
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

    this.screen.append(container);
    this.screen.append(inputBox);
    
    inputBox.focus();
    this.screen.render();

    // 监听回车事件
    inputBox.on('submit', (value: string) => {
      onSubmit(value);
    });

    // 监听任意按键开始对话
    this.screen.key('enter', () => {
      const value = inputBox.getValue();
      if (value.trim()) {
        onSubmit(value);
      } else {
        onSubmit('');
      }
    });
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
