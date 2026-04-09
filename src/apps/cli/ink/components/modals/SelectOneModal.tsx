/**
 * SelectOneModal - Self-contained single selection modal
 * Usage: showSelectOne({ title, message, choices, selected?, onSubmit, onCancel? })
 */
import React, { useReducer, useEffect } from 'react';
import { Box, Text } from 'ink';
import { ModalFrame } from './ModalFrame.js';
import { padToWidth, wrapToWidth } from './textLayout.js';
import { useInput } from 'ink';
import { modalVisibility, setModalVisibility } from './visibility.js';

export interface ModalChoice {
  label: string;
  value: string;
}

interface SelectOneState {
  visible: boolean;
  title: string;
  message?: string;
  choices: ModalChoice[];
  selected: number;
  footer?: string;
  emptyLabel?: string;
  onSubmit?: (choice: ModalChoice, index: number) => void;
  onCancel?: () => void;
}

type SelectOneAction =
  | { type: 'SHOW'; title: string; message?: string; choices: ModalChoice[]; selected?: number; footer?: string; emptyLabel?: string; onSubmit?: (choice: ModalChoice, index: number) => void; onCancel?: () => void }
  | { type: 'HIDE' }
  | { type: 'MOVE'; delta: number };

function selectOneReducer(state: SelectOneState, action: SelectOneAction): SelectOneState {
  switch (action.type) {
    case 'SHOW': {
      const maxIndex = Math.max(0, action.choices.length - 1);
      const selected = Math.max(0, Math.min(action.selected ?? 0, maxIndex));
      return { visible: true, title: action.title, message: action.message, choices: action.choices, selected, footer: action.footer, emptyLabel: action.emptyLabel, onSubmit: action.onSubmit, onCancel: action.onCancel };
    }
    case 'HIDE':
      return { ...state, visible: false };
    case 'MOVE': {
      if (state.choices.length === 0) return state;
      const maxIndex = Math.max(0, state.choices.length - 1);
      const nextSelected = Math.max(0, Math.min(state.selected + action.delta, maxIndex));
      return { ...state, selected: nextSelected };
    }
    default:
      return state;
  }
}

let selectOneReducerRef: React.Dispatch<SelectOneAction> | null = null;

export function showSelectOne(opts: { title: string; message?: string; choices: ModalChoice[]; selected?: number; footer?: string; emptyLabel?: string; onSubmit?: (choice: ModalChoice, index: number) => void; onCancel?: () => void }) {
  selectOneReducerRef?.({ type: 'SHOW', ...opts });
}

export function hideSelectOne() {
  selectOneReducerRef?.({ type: 'HIDE' });
}

export function isSelectOneVisible() {
  return modalVisibility.selectOne;
}

export function SelectOneModal() {
  const [state, dispatch] = useReducer(selectOneReducer, {
    visible: false,
    title: '',
    choices: [],
    selected: 0,
  });

  useEffect(() => {
    selectOneReducerRef = dispatch;
    setModalVisibility('selectOne', state.visible);
    return () => {
      selectOneReducerRef = null;
      setModalVisibility('selectOne', false);
    };
  }, [state.visible]);

  useInput((input, key) => {
    if (!state.visible) return;

    if (key.escape) {
      const onCancel = state.onCancel;
      dispatch({ type: 'HIDE' });
      onCancel?.();
      return;
    }

    if (key.upArrow) {
      dispatch({ type: 'MOVE', delta: -1 });
      return;
    }

    if (key.downArrow) {
      dispatch({ type: 'MOVE', delta: 1 });
      return;
    }

    if (key.return || key.tab) {
      const choice = state.choices[state.selected];
      const onSubmit = state.onSubmit;
      dispatch({ type: 'HIDE' });
      if (choice) onSubmit?.(choice, state.selected);
    }
  }, { isActive: state.visible });

  if (!state.visible) return null;

  const innerWidth = 64;
  const maxVisible = 8;
  const total = state.choices.length;
  const windowStart = Math.min(
    Math.max(0, state.selected - (maxVisible - 1)),
    Math.max(0, total - maxVisible),
  );
  const windowItems = state.choices.slice(windowStart, windowStart + maxVisible);

  return (
    <Box
      position="absolute"
      width="100%"
      height="100%"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      paddingX={2}
    >
      <ModalFrame
        title={state.title}
        width={72}
        footer={state.footer || '↑/↓ Navigate • Enter Select • Esc Cancel'}
      >
        {state.message && wrapToWidth(state.message, innerWidth).map((line, index) => (
          <Box key={`message-${index}`}>
            <Text>{padToWidth(line, innerWidth)}</Text>
          </Box>
        ))}
        {state.message && (
          <Box>
            <Text>{padToWidth('', innerWidth)}</Text>
          </Box>
        )}

        {windowItems.length === 0 ? (
          <Box>
            <Text dimColor>{padToWidth(state.emptyLabel || 'No items available', innerWidth)}</Text>
          </Box>
        ) : (
          windowItems.map((item, idx) => {
            const globalIndex = windowStart + idx;
            const isSelected = globalIndex === state.selected;
            const prefix = isSelected ? '› ' : '  ';
            return (
              <Box key={`${globalIndex}-${item.value}`}>
                <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected} dimColor={!isSelected}>
                  {padToWidth(`${prefix}${item.label}`, innerWidth)}
                </Text>
              </Box>
            );
          })
        )}
      </ModalFrame>
    </Box>
  );
}
