/**
 * NoticeModal - Self-contained notice modal
 * Usage: showNotice({ title, message, footer })
 */
import React, { useReducer, useEffect } from 'react';
import { Box, Text } from 'ink';
import { ModalFrame } from './ModalFrame.js';
import { useInput } from 'ink';
import { modalVisibility } from './visibility.js';

interface NoticeState {
  visible: boolean;
  title: string;
  message: string;
  footer?: string;
  onClose?: () => void;
}

type NoticeAction =
  | { type: 'SHOW'; title: string; message: string; footer?: string; onClose?: () => void }
  | { type: 'HIDE' };

function noticeReducer(state: NoticeState, action: NoticeAction): NoticeState {
  switch (action.type) {
    case 'SHOW':
      return { visible: true, title: action.title, message: action.message, footer: action.footer, onClose: action.onClose };
    case 'HIDE':
      return { ...state, visible: false };
    default:
      return state;
  }
}

let noticeReducerRef: React.Dispatch<NoticeAction> | null = null;

export function showNotice(opts: { title: string; message: string; footer?: string; onClose?: () => void }) {
  noticeReducerRef?.({ type: 'SHOW', ...opts });
}

export function hideNotice() {
  noticeReducerRef?.({ type: 'HIDE' });
}

export function isNoticeVisible() {
  return modalVisibility.notice;
}

export function NoticeModal() {
  const [state, dispatch] = useReducer(noticeReducer, {
    visible: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    noticeReducerRef = dispatch;
    modalVisibility.notice = state.visible;
    return () => {
      noticeReducerRef = null;
      modalVisibility.notice = false;
    };
  }, [state.visible]);

  useInput((_input, key) => {
    if (!state.visible) return;
    if (key.escape || key.return) {
      const onClose = state.onClose;
      dispatch({ type: 'HIDE' });
      onClose?.();
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
        footer={state.footer || 'Esc / Enter Close'}
      >
        <Text>{state.message}</Text>
      </ModalFrame>
    </Box>
  );
}
