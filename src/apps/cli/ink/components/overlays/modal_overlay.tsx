import React from 'react';
import { Box } from 'ink';
import { ModalOverlayProps, ModalState } from './types.js';
import { PromptBox } from './prompt_box.js';
import { SelectList } from './select_list.js';
import { SelectManyList } from './select_many_list.js';

// Simple helper to estimate visual width of a string (considering double-width CJK characters)
function getVisualWidth(str: string): number {
  if (!str) return 0;
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    // Rough estimation for CJK characters: those above 0x1100 usually occupy 2 cells
    if (charCode >= 0x1100) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

function isApiKeyAskModal(modal: ModalState): boolean {
  return modal.kind === 'ask' && (modal.message || '').startsWith('API Key for ');
}

export function ModalOverlay({ modal, columns, rows, apiKeyInput = '' }: ModalOverlayProps) {
  if (modal.kind === 'none') return null;

  const apiKeyMode = isApiKeyAskModal(modal);

  const calculateContentWidth = () => {
    let max = 40;

    if (modal.message) {
      const lines = modal.message.split('\n');
      lines.forEach(l => { max = Math.max(max, getVisualWidth(l) + 6); });
    }

    if ('choices' in modal && modal.choices) {
      modal.choices.forEach(c => { max = Math.max(max, getVisualWidth(c) + 10); });
    }

    let footerText = '';
    switch (modal.kind) {
      case 'ask': footerText = apiKeyMode ? 'Enter to Save • Esc to Cancel' : 'Enter to Close • Esc to Cancel'; break;
      case 'confirm': footerText = 'Enter Confirm • Esc Cancel'; break;
      case 'selectOne': footerText = '↑/↓ Navigate • Enter Select • Esc Cancel'; break;
      case 'selectMany': footerText = '↑/↓ Move • Space Toggle • Enter Confirm • Esc Cancel'; break;
    }
    max = Math.max(max, getVisualWidth(footerText) + 10);

    return Math.min(max, columns - 4, 100);
  };

  const contentWidth = calculateContentWidth();

  return (
    <Box
      position="absolute"
      width={columns}
      height={rows}
      alignItems="center"
      justifyContent="center"
    >
      <Box
        flexDirection="column"
        width={contentWidth}
        padding={0}
        borderStyle="round"
        borderColor="cyan"
        {...({ backgroundColor: 'black' } as any)}
      >
        <Box width="100%" flexDirection="column" {...({ backgroundColor: 'black' } as any)}>
          {modal.kind === 'ask' && (
            <PromptBox
              title={apiKeyMode ? 'Enter API Key' : 'Notice'}
              body={modal.message}
              input={apiKeyMode ? (apiKeyInput || modal.value) : ''}
              footer={apiKeyMode ? 'Enter to Save • Esc to Cancel' : 'Enter to Close • Esc to Cancel'}
              width={contentWidth - 2}
              showInput={apiKeyMode}
            />
          )}
          {modal.kind === 'confirm' && (
            <PromptBox
              title="Confirm Action"
              body={modal.message}
              footer="Enter Confirm • Esc Cancel"
              width={contentWidth - 2}
            />
          )}
          {modal.kind === 'selectOne' && (
            <SelectList
              title={modal.message}
              choices={modal.choices}
              selected={modal.selected}
              footer="↑/↓ Navigate • Enter Select • Esc Cancel"
              width={contentWidth - 2}
            />
          )}
          {modal.kind === 'selectMany' && (
            <SelectManyList
              title={modal.message}
              choices={modal.choices}
              selected={modal.selected}
              picked={modal.picked}
              footer="↑/↓ Move • Space Toggle • Enter Confirm • Esc Cancel"
              width={contentWidth - 2}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}

export const PromptOverlay = ModalOverlay;
