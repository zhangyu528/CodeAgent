/**
 * AskModal - Self-contained ask/input modal
 * Usage: showAsk({ title, message, value?, onSubmit, onCancel? })
 */
import React, { useReducer, useEffect } from 'react';
import { Box, Text } from 'ink';
import { ModalFrame } from './ModalFrame.js';
import { padToWidth } from './textLayout.js';
import { useInput } from 'ink';
import { modalVisibility } from './visibility.js';

interface AskState {
  visible: boolean;
  title: string;
  message?: string;
  value: string;
  footer?: string;
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
}

type AskAction =
  | { type: 'SHOW'; title: string; message?: string; value?: string; footer?: string; onSubmit?: (value: string) => void; onCancel?: () => void }
  | { type: 'HIDE' }
  | { type: 'APPEND'; text: string }
  | { type: 'BACKSPACE' };

function askReducer(state: AskState, action: AskAction): AskState {
  switch (action.type) {
    case 'SHOW':
      return { visible: true, title: action.title, message: action.message, value: action.value ?? '', footer: action.footer, onSubmit: action.onSubmit, onCancel: action.onCancel };
    case 'HIDE':
      return { ...state, visible: false };
    case 'APPEND':
      return { ...state, value: state.value + action.text };
    case 'BACKSPACE':
      return { ...state, value: state.value.slice(0, -1) };
    default:
      return state;
  }
}

let askReducerRef: React.Dispatch<AskAction> | null = null;

export function showAsk(opts: { title: string; message?: string; value?: string; footer?: string; onSubmit?: (value: string) => void; onCancel?: () => void }) {
  askReducerRef?.({ type: 'SHOW', ...opts });
}

export function hideAsk() {
  askReducerRef?.({ type: 'HIDE' });
}

export function isAskVisible() {
  return modalVisibility.ask;
}

export function AskModal() {
  const [state, dispatch] = useReducer(askReducer, {
    visible: false,
    title: '',
    value: '',
  });

  useEffect(() => {
    askReducerRef = dispatch;
    modalVisibility.ask = state.visible;
    return () => {
      askReducerRef = null;
      modalVisibility.ask = false;
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

    if (key.return) {
      const onSubmit = state.onSubmit;
      const value = state.value;
      dispatch({ type: 'HIDE' });
      onSubmit?.(value);
      return;
    }

    if (key.backspace || key.delete) {
      dispatch({ type: 'BACKSPACE' });
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      dispatch({ type: 'APPEND', text: input });
    }
  }, { isActive: state.visible });

  if (!state.visible) return null;

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
        footer={state.footer || 'Type to edit • Enter Confirm • Esc Cancel'}
      >
        {state.message && <Text>{state.message}</Text>}
        {state.message && <Box height={1} />}
        <Text bold>> {padToWidth(state.value, 64)}</Text>
      </ModalFrame>
    </Box>
  );
}
