/**
 * ConfirmModal - Self-contained confirm modal
 * Usage: showConfirm({ title, message, onConfirm, onCancel? })
 */
import React, { useReducer, useEffect } from 'react';
import { Box, Text } from 'ink';
import { ModalFrame } from './ModalFrame.js';
import { useInput } from 'ink';
import { modalVisibility } from './visibility.js';

interface ConfirmState {
  visible: boolean;
  title: string;
  message: string;
  footer?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

type ConfirmAction =
  | { type: 'SHOW'; title: string; message: string; footer?: string; onConfirm?: () => void; onCancel?: () => void }
  | { type: 'HIDE' };

function confirmReducer(state: ConfirmState, action: ConfirmAction): ConfirmState {
  switch (action.type) {
    case 'SHOW':
      return { visible: true, title: action.title, message: action.message, footer: action.footer, onConfirm: action.onConfirm, onCancel: action.onCancel };
    case 'HIDE':
      return { ...state, visible: false };
    default:
      return state;
  }
}

let confirmReducerRef: React.Dispatch<ConfirmAction> | null = null;

export function showConfirm(opts: { title: string; message: string; footer?: string; onConfirm?: () => void; onCancel?: () => void }) {
  confirmReducerRef?.({ type: 'SHOW', ...opts });
}

export function hideConfirm() {
  confirmReducerRef?.({ type: 'HIDE' });
}

export function isConfirmVisible() {
  return modalVisibility.confirm;
}

export function ConfirmModal() {
  const [state, dispatch] = useReducer(confirmReducer, {
    visible: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    confirmReducerRef = dispatch;
    modalVisibility.confirm = state.visible;
    return () => {
      confirmReducerRef = null;
      modalVisibility.confirm = false;
    };
  }, [state.visible]);

  useInput((_input, key) => {
    if (!state.visible) return;

    if (key.escape) {
      const onCancel = state.onCancel;
      dispatch({ type: 'HIDE' });
      onCancel?.();
      return;
    }

    if (key.return) {
      const onConfirm = state.onConfirm;
      dispatch({ type: 'HIDE' });
      onConfirm?.();
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
        footer={state.footer || 'Enter Confirm • Esc Cancel'}
      >
        <Text>{state.message}</Text>
      </ModalFrame>
    </Box>
  );
}
