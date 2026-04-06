import React from 'react';
import { Box } from 'ink';
import { useModalController } from './ModalController.js';
import { PromptBox } from './PromptBox.js';
import { SelectList } from './SelectList.js';
import { SelectManyList } from './SelectManyList.js';

const MODAL_RENDERERS = {
  notice: ({ title, message, footer, width }: { title: string; message: string; footer?: string; width: number }) => (
    <PromptBox
      title={title}
      body={message}
      footer={footer || 'Esc / Enter Close'}
      width={width}
    />
  ),
  ask: ({ title, message, value, footer, width }: { title: string; message?: string; value: string; footer?: string; width: number }) => (
    <PromptBox
      title={title}
      body={message || ''}
      input={value}
      showInput
      footer={footer || 'Type to edit • Enter Confirm • Esc Cancel'}
      width={width}
    />
  ),
  confirm: ({ title, message, footer, width }: { title: string; message: string; footer?: string; width: number }) => (
    <PromptBox
      title={title}
      body={message}
      footer={footer || 'Enter Confirm • Esc Cancel'}
      width={width}
    />
  ),
  selectOne: ({ title, message, choices, selected, footer, emptyLabel, width }: { title: string; message?: string; choices: any[]; selected: number; footer?: string; emptyLabel?: string; width: number }) => (
    <SelectList
      title={title}
      message={message}
      choices={choices}
      selected={selected}
      footer={footer || '↑/↓ Navigate • Enter Select • Esc Cancel'}
      emptyLabel={emptyLabel}
      width={width}
    />
  ),
  selectMany: ({ title, message, choices, selected, picked, footer, emptyLabel, width }: { title: string; message?: string; choices: any[]; selected: number; picked: Set<number>; footer?: string; emptyLabel?: string; width: number }) => (
    <SelectManyList
      title={title}
      message={message}
      choices={choices}
      selected={selected}
      picked={picked}
      footer={footer || '↑/↓ Move • Space Toggle • Enter Confirm • Esc Cancel'}
      emptyLabel={emptyLabel}
      width={width}
    />
  ),
} as const;

export function ModalContainer() {
  const { modal, width } = useModalController();
  if (modal.kind === 'none') return null;

  const Renderer = MODAL_RENDERERS[modal.kind];
  if (!Renderer) return null;

  return (
    <Box
      position="absolute"
      width="100%"
      height="100%"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      paddingX={2}
      backgroundColor="black"
    >
      <Renderer {...(modal as any)} width={width} />
    </Box>
  );
}
