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
  ' / __|___  __| | ___   /_\\\\  __ _ ___ _ _  __| |_ ',
  "| (__/ _ \\\\/ _` |/ -_) / _ \\\\/ _` / -_) ' \\\\/ _`  _|",
  ' \\\\___\\\\___/\\\\__,_|\\\\___|/_/ \\\\_\\\\__, \\\\___|_||_\\\\__,_\\\\__|',
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
          or use <Text color="yellow">/resume</Text> to continue last session • <Text color="yellow">/history</Text> to pick
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
  const lines = props.lines.slice(-200);
  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1} flexShrink={1} justifyContent="flex-end">
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
            ? 'Enter to start new session • /resume for last session • /history to pick • /help for commands' 
            : 'Type message to chat • /new for welcome • /clear to reset'}
        </Text>
      </Box>
    </Box>
  );
}

export function SlashPalette(props: SlashPaletteProps) {
  if (!props.visible || props.items.length === 0) return null;

  const maxVisible = 10;
  const total = props.items.length;
  const windowStart = Math.min(
    Math.max(0, props.selectedIndex - (maxVisible - 1)),
    Math.max(0, total - maxVisible),
  );
  const windowItems = props.items.slice(windowStart, windowStart + maxVisible);

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} width="100%" borderColor="cyan">
      {windowItems.map((item, idx) => {
        const globalIndex = windowStart + idx;
        const isSelected = globalIndex === props.selectedIndex;
        const matchIndex = item.name.toLowerCase().indexOf(props.query.toLowerCase());
        const hasMatch = matchIndex !== -1 && props.query.length > 0;

        return (
          <Box key={item.name} flexDirection="column">
            <Box>
              <Text {...(isSelected ? { color: 'cyan', bold: true } : {})}>
                {isSelected ? '● ' : '  '}
              </Text>
              
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

export function HistoryPicker(props: HistoryPickerProps) {
  if (!props.visible) return null;

  const maxVisible = 10;
  const total = props.items.length;
  const windowStart = Math.min(
    Math.max(0, props.selectedIndex - (maxVisible - 1)),
    Math.max(0, total - maxVisible),
  );
  const windowItems = props.items.slice(windowStart, windowStart + maxVisible);

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} width="100%" borderColor="cyan">
      {props.items.length === 0 ? <Box paddingX={3}><Text dimColor>No history sessions found</Text></Box> : null}
      {windowItems.map((s, idx) => {
        const globalIndex = windowStart + idx;
        const isSelected = globalIndex === props.selectedIndex;
        return (
          <Text
            key={s.id}
            {...(isSelected ? { color: 'cyan' as const, bold: true } : {})}
          >
          {isSelected ? '● ' : '  '}
          {s.title} ({s.id.slice(0, 8)})
          </Text>
        );
      })}
    </Box>
  );
}

export function SelectList(props: {
  title: string;
  choices: string[];
  selected: number;
  footer?: string;
}) {
  const maxVisible = 10;
  const total = props.choices.length;
  const windowStart = Math.min(
    Math.max(0, props.selected - (maxVisible - 1)),
    Math.max(0, total - maxVisible),
  );
  const windowItems = props.choices.slice(windowStart, windowStart + maxVisible);

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} width="100%" borderColor="cyan">
      <Box marginBottom={0}>
        <Text bold color="cyan">{props.title}</Text>
      </Box>
      {windowItems.map((item, idx) => {
        const globalIndex = windowStart + idx;
        const isSelected = globalIndex === props.selected;
        return (
          <Text
            key={`${globalIndex}-${item}`}
            {...(isSelected ? { color: 'cyan', bold: true } : {})}
          >
            {isSelected ? '● ' : '  '}{item}
          </Text>
        );
      })}
      {props.footer && (
        <Box marginTop={0}>
          <Text dimColor italic>{props.footer}</Text>
        </Box>
      )}
    </Box>
  );
}

export function SelectManyList(props: {
  title: string;
  choices: string[];
  selected: number;
  picked: Set<number>;
  footer?: string;
}) {
  const maxVisible = 10;
  const total = props.choices.length;
  const windowStart = Math.min(
    Math.max(0, props.selected - (maxVisible - 1)),
    Math.max(0, total - maxVisible),
  );
  const windowItems = props.choices.slice(windowStart, windowStart + maxVisible);

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} width="100%" borderColor="cyan">
      <Box marginBottom={0}>
        <Text bold color="cyan">{props.title}</Text>
      </Box>
      {windowItems.map((item, idx) => {
        const globalIndex = windowStart + idx;
        const isSelected = globalIndex === props.selected;
        const isPicked = props.picked.has(globalIndex);
        const checkbox = isPicked ? '[✓]' : '[ ]';
        return (
          <Box key={`${globalIndex}-${item}`}>
            <Text {...(isSelected ? { color: 'cyan', bold: true } : {})}>
              {isSelected ? '● ' : '  '}
            </Text>
            <Text {...(isPicked ? { color: 'cyan' as const, bold: true } : {})}>
              {checkbox}
            </Text>
            <Text {...(isSelected ? { color: 'white', bold: true } : {})}>
              {' '}{item}
            </Text>
          </Box>
        );
      })}
      {props.footer && (
        <Box marginTop={0}>
          <Text dimColor italic>{props.footer}</Text>
        </Box>
      )}
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
  prompt:
    | { kind: 'none' }
    | { kind: 'ask'; message: string; value: string }
    | { kind: 'confirm'; message: string }
    | { kind: 'selectOne'; message: string; choices: string[]; selected: number }
    | { kind: 'selectMany'; message: string; choices: string[]; selected: number; picked: Set<number> };
}) {
  const isWelcome = props.page === 'welcome';
  const { prompt } = props;

  return (
    <Box flexDirection="column" width="100%">
      {/* Chat mode: popups above InputBar */}
      {!isWelcome && (
        <>
          {prompt.kind === 'ask' && <PromptBox title="Input" body={prompt.message} input={prompt.value} footer="Enter 提交，Esc 取消" />}
          {prompt.kind === 'confirm' && <PromptBox title="Confirm" body={prompt.message} footer="Y/Enter 确认，N/Esc 取消" />}
          {prompt.kind === 'selectOne' && (
            <SelectList
              title={prompt.message}
              choices={prompt.choices}
              selected={prompt.selected}
              footer="↑/↓ 选择，Enter 确认"
            />
          )}
          {prompt.kind === 'selectMany' && (
            <SelectManyList
              title={prompt.message}
              choices={prompt.choices}
              selected={prompt.selected}
              picked={prompt.picked}
              footer="↑/↓ 移动，Space 勾选，Enter 确认"
            />
          )}
          <SlashPalette 
            visible={props.slashVisible} 
            items={props.slashItems} 
            selectedIndex={props.slashSelected} 
            query={props.value}
          />
          <HistoryPicker 
            visible={props.historyVisible} 
            items={props.historyItems} 
            selectedIndex={props.historySelected} 
          />
        </>
      )}

      <InputBar value={props.value} page={props.page} />

      {/* Welcome mode: popups below InputBar */}
      {isWelcome && (
        <>
          <SlashPalette 
            visible={props.slashVisible} 
            items={props.slashItems} 
            selectedIndex={props.slashSelected} 
            query={props.value}
          />
          <HistoryPicker 
            visible={props.historyVisible} 
            items={props.historyItems} 
            selectedIndex={props.historySelected} 
          />
          {prompt.kind === 'ask' && <PromptBox title="Input" body={prompt.message} input={prompt.value} footer="Enter 提交，Esc 取消" />}
          {prompt.kind === 'confirm' && <PromptBox title="Confirm" body={prompt.message} footer="Y/Enter 确认，N/Esc 取消" />}
          {prompt.kind === 'selectOne' && (
            <SelectList
              title={prompt.message}
              choices={prompt.choices}
              selected={prompt.selected}
              footer="↑/↓ 选择，Enter 确认"
            />
          )}
          {prompt.kind === 'selectMany' && (
            <SelectManyList
              title={prompt.message}
              choices={prompt.choices}
              selected={prompt.selected}
              picked={prompt.picked}
              footer="↑/↓ 移动，Space 勾选，Enter 确认"
            />
          )}
        </>
      )}
    </Box>
  );
}

export function PromptBox(props: { title: string; body: string; input?: string; footer?: string }) {
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} borderColor="cyan">
      <Text bold color="cyan">{props.title}</Text>
      <Text>{props.body}</Text>
      {typeof props.input === 'string' ? (
        <Box>
          <Text color="cyan" bold>❯ </Text>
          <Text>{props.input}</Text>
        </Box>
      ) : null}
      {props.footer ? <Text dimColor italic>{props.footer}</Text> : null}
    </Box>
  );
}