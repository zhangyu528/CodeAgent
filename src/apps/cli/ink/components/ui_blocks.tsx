import React from 'react';
import { Box, Text } from 'ink';

type ChatLine = { id: string; text: string };

type WelcomeProps = {
  version: string;
  cwd: string;
  logs: string[];
  rows: number;
  cols: number;
};

type ChatHeaderProps = {
  title: string;
  shortSessionId: string;
};

type ChatPageProps = {
  lines: ChatLine[];
};

type InputBarProps = {
  value: string;
  page: 'welcome' | 'chat';
};

type SlashPaletteProps = {
  visible: boolean;
  items: Array<{ name: string; description: string }>;
  selectedIndex: number;
};

type HistoryPickerProps = {
  visible: boolean;
  items: Array<{ id: string; title: string }>;
  selectedIndex: number;
};

const ASCII_LOGO = [
  '  ___            _        _                    _  ',
  ' / __|___  __| | ___   /_\\  __ _ ___ _ _  __| |_ ',
  "| (__/ _ \\/ _` |/ -_) / _ \\/ _` / -_) ' \\/ _`  _|",
  ' \\___\\___/\\__,_|\\___|/_/ \\_\\__, \\___|_||_\\__,_\\__|',
  '                           |___/                  ',
];

function centerLine(text: string, width: number): string {
  const safeWidth = Math.max(20, width);
  const clipped = text.length > safeWidth ? text.slice(0, Math.max(1, safeWidth - 3)) + '...' : text;
  const pad = Math.max(0, Math.floor((safeWidth - clipped.length) / 2));
  return `${' '.repeat(pad)}${clipped}`;
}

export function WelcomePage(props: WelcomeProps) {
  const rows = Math.max(12, props.rows);
  const cols = Math.max(40, props.cols - 2);

  const contentBlock = [
    ...ASCII_LOGO,
    '',
    `version: ${props.version}`,
    `cwd: ${props.cwd}`,
    '',
    '输入消息回车新建会话，或输入 /history 继续历史会话',
  ];

  const visibleLogs = props.logs.slice(-4);
  const lines = [
    ...contentBlock,
    ...(visibleLogs.length > 0 ? [''] : []),
    ...visibleLogs,
  ].map((line) => centerLine(line, cols));

  return (
    <Box flexDirection="column" height={rows} width={cols + 2} justifyContent="center">
      {lines.map((line, idx) => (
        <Text key={`w-${idx}`}>{line}</Text>
      ))}
    </Box>
  );
}

export function ChatHeader(props: ChatHeaderProps) {
  return (
    <Box flexDirection="column">
      <Text>{props.title}  (#{props.shortSessionId})</Text>
      <Text>{'-'.repeat(72)}</Text>
    </Box>
  );
}

export function ChatPage(props: ChatPageProps) {
  const lines = props.lines.slice(-120);
  return (
    <Box flexDirection="column" paddingX={1}>
      {lines.length === 0 ? <Text dimColor>暂无消息</Text> : null}
      {lines.map((line) => (
        <Text key={line.id}>{line.text}</Text>
      ))}
    </Box>
  );
}

export function InputBar(props: InputBarProps) {
  const hint = props.page === 'welcome'
    ? 'welcome: 输入文本新建会话，/history 选历史'
    : 'chat: 输入消息继续对话，/new 回欢迎页';

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text>❯ {props.value}</Text>
      <Text dimColor>{hint}</Text>
    </Box>
  );
}

export function SlashPalette(props: SlashPaletteProps) {
  if (!props.visible || props.items.length === 0) return null;
  return (
    <Box
      {...({
        flexDirection: "column",
        borderStyle: "round",
        paddingX: 1,
        position: "absolute",
        bottom: 4,
        left: 2,
        borderColor: "cyan"
      } as any)}
    >
      <Text bold color="cyan">Command Suggestions</Text>
      {props.items.slice(0, 10).map((item, idx) => (
        <Box key={item.name}>
          <Text {...(idx === props.selectedIndex ? { color: 'cyan' as const, bold: true } : {})}>
            {idx === props.selectedIndex ? '› ' : '  '}
            {item.name.padEnd(12)}
          </Text>
          <Text dimColor> {item.description}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function HistoryPicker(props: HistoryPickerProps) {
  if (!props.visible) return null;
  return (
    <Box
      {...({
        flexDirection: "column",
        borderStyle: "double",
        paddingX: 1,
        position: "absolute",
        bottom: 4,
        left: 2,
        borderColor: "green"
      } as any)}
    >
      <Text bold color="green">Select History Session (↑/↓ + Enter)</Text>
      {props.items.length === 0 ? <Text dimColor>No history sessions found</Text> : null}
      {props.items.slice(0, 10).map((s, idx) => (
        <Text key={s.id} {...(idx === props.selectedIndex ? { color: 'green' as const, bold: true } : {})}>
          {idx === props.selectedIndex ? '› ' : '  '}
          {s.title} ({s.id.slice(0, 8)})
        </Text>
      ))}
    </Box>
  );
}

export function PromptBox(props: { title: string; body: string; input?: string; footer?: string }) {
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1} marginY={1}>
      <Text>{props.title}</Text>
      <Text>{props.body}</Text>
      {typeof props.input === 'string' ? <Text>❯ {props.input}</Text> : null}
      {props.footer ? <Text dimColor>{props.footer}</Text> : null}
    </Box>
  );
}