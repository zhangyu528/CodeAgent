import React from 'react';
import { Box, Text } from 'ink';

type ChatLine = { id: string; text: string };

type WelcomeProps = {
  version: string;
  cwd: string;
  provider?: string;
  logs: string[];
  rows: number;
  cols: number;
  children?: React.ReactNode;
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
  items: Array<{ name: string; description: string; category: string; usage: string }>;
  selectedIndex: number;
  query: string;
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

  return (
    <Box flexDirection="column" height={rows} width={cols + 2} justifyContent="center" alignItems="center">
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        {ASCII_LOGO.map((line, idx) => (
          <Text key={idx} color="cyan">{line}</Text>
        ))}
      </Box>

      <Box borderStyle="round" borderColor="gray" paddingX={2} flexDirection="column" alignItems="center">
        <Box marginBottom={1}>
          <Text bold>CodeAgent </Text>
          <Text dimColor>v{props.version}</Text>
        </Box>
        
        <Box flexDirection="column">
          <Box>
            <Text color="gray">Provider: </Text>
            <Text color="green">{props.provider || 'unknown'}</Text>
          </Box>
          <Box>
            <Text color="gray">Workspace: </Text>
            <Text dimColor>{props.cwd}</Text>
          </Box>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text>
          Type a message to <Text color="cyan" bold>Start Chat</Text>
        </Text>
        <Text dimColor>
          or use <Text color="yellow">/history</Text> to resume a session
        </Text>
      </Box>

      {props.children && (
        <Box width={Math.min(cols - 4, 80)} marginTop={1}>
          {props.children}
        </Box>
      )}

      {props.logs.length > 0 && (
        <Box marginTop={1} flexDirection="column" alignItems="center">
          {props.logs.slice(-2).map((log, idx) => (
            <Text key={idx} dimColor italic>· {log}</Text>
          ))}
        </Box>
      )}
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
  const isWelcome = props.page === 'welcome';
  const borderColor = isWelcome ? 'cyan' : 'gray';

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={borderColor} paddingX={1}>
      <Box>
        <Text color="cyan" bold>❯ </Text>
        <Text>{props.value}</Text>
      </Box>
      <Box marginTop={0}>
        <Text dimColor italic>
          {isWelcome 
            ? 'Enter to start new session • /history for recent • /help for commands' 
            : 'Type message to chat • /new for welcome • /clear to reset'}
        </Text>
      </Box>
    </Box>
  );
}

export function SlashPalette(props: SlashPaletteProps & { isWelcome: boolean }) {
  if (!props.visible || props.items.length === 0) return null;

  const positionProps = props.isWelcome 
    ? { top: 1 } // Display below in welcome mode
    : { bottom: 1 }; // Display above in chat mode (at bottom of screen)

  return (
    <Box
      {...({
        flexDirection: "column",
        borderStyle: "round",
        paddingX: 1,
        position: "absolute",
        left: 0,
        width: "100%",
        borderColor: "cyan",
        backgroundColor: "#1e1e1e",
        ...positionProps
      } as any)}
    >
      {props.items.slice(0, 8).map((item, idx) => {
        const isSelected = idx === props.selectedIndex;
        const matchIndex = item.name.toLowerCase().indexOf(props.query.toLowerCase());
        const hasMatch = matchIndex !== -1 && props.query.length > 0;

        return (
          <Box key={item.name} flexDirection="column">
            <Box>
              <Text {...(isSelected ? { color: 'cyan', bold: true } : {})}>
                {isSelected ? '● ' : '  '}
              </Text>
              
              {/* Highlight matching part with higher contrast */}
              {hasMatch ? (
                <>
                  <Text {...(isSelected ? { color: 'white' } : {})}>{item.name.slice(0, matchIndex)}</Text>
                  <Text color="cyan" bold underline={isSelected}>{item.name.slice(matchIndex, matchIndex + props.query.length)}</Text>
                  <Text {...(isSelected ? { color: 'white' } : {})}>{item.name.slice(matchIndex + props.query.length)}</Text>
                </>
              ) : (
                <Text {...(isSelected ? { color: 'white' } : {})}>{item.name}</Text>
              )}

              <Text dimColor>  {item.description}</Text>
              <Text color="gray" dimColor> [{item.category}]</Text>
            </Box>
            {isSelected && (
              <Box paddingLeft={4}>
                <Text dimColor italic>Usage: {item.usage}</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export function HistoryPicker(props: HistoryPickerProps & { isWelcome: boolean }) {
  if (!props.visible) return null;

  const positionProps = props.isWelcome 
    ? { top: 1 } 
    : { bottom: 1 };

  return (
    <Box
      {...({
        flexDirection: "column",
        borderStyle: "double",
        paddingX: 1,
        position: "absolute",
        left: 0,
        width: "100%",
        borderColor: "green",
        backgroundColor: "#1e1e1e",
        ...positionProps
      } as any)}
    >
      {props.items.length === 0 ? <Box paddingX={3}><Text dimColor>No history sessions found</Text></Box> : null}
      {props.items.slice(0, 10).map((s, idx) => (
        <Text key={s.id} {...(idx === props.selectedIndex ? { color: 'green' as const, bold: true } : {})}>
          {idx === props.selectedIndex ? '● ' : '  '}
          {s.title} ({s.id.slice(0, 8)})
        </Text>
      ))}
    </Box>
  );
}

export function InputArea(props: {
  value: string;
  page: 'welcome' | 'chat';
  slashVisible: boolean;
  slashItems: Array<{ name: string; description: string; category: string; usage: string }>;
  slashSelected: number;
  historyVisible: boolean;
  historyItems: Array<{ id: string; title: string }>;
  historySelected: number;
}) {
  const isWelcome = props.page === 'welcome';

  return (
    <Box flexDirection="column" width="100%">
      {/* Above anchor for chat mode */}
      {!isWelcome && (
        <Box height={0} position="relative" width="100%">
          <SlashPalette 
            visible={props.slashVisible} 
            items={props.slashItems} 
            selectedIndex={props.slashSelected} 
            query={props.value}
            isWelcome={false}
          />
          <HistoryPicker 
            visible={props.historyVisible} 
            items={props.historyItems} 
            selectedIndex={props.historySelected} 
            isWelcome={false}
          />
        </Box>
      )}

      <InputBar value={props.value} page={props.page} />

      {/* Below anchor for welcome mode */}
      {isWelcome && (
        <Box height={0} position="relative" width="100%">
          <SlashPalette 
            visible={props.slashVisible} 
            items={props.slashItems} 
            selectedIndex={props.slashSelected} 
            query={props.value}
            isWelcome={true}
          />
          <HistoryPicker 
            visible={props.historyVisible} 
            items={props.historyItems} 
            selectedIndex={props.historySelected} 
            isWelcome={true}
          />
        </Box>
      )}
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