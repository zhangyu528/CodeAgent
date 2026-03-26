import React from 'react';
import { Box } from 'ink';
import { ModalOverlayProps, ChoicePrompt } from './types.js';
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

function isApiKeyAskPrompt(prompt: ChoicePrompt): boolean {
  return prompt.kind === 'ask' && (prompt.message || '').startsWith('API Key for ');
}

export function ModalOverlay({ prompt, columns, rows, apiKeyInput = '' }: ModalOverlayProps) {
  if (prompt.kind === 'none') return null;

  const apiKeyMode = isApiKeyAskPrompt(prompt);

  // Calculate the content width dynamically
  const calculateContentWidth = () => {
    let max = 40; // Base minimum width

    // 1. Message width
    if (prompt.message) {
      const lines = prompt.message.split('\n');
      lines.forEach(l => { max = Math.max(max, getVisualWidth(l) + 6); });
    }

    // 2. Choices width
    if ('choices' in prompt && prompt.choices) {
      prompt.choices.forEach(c => { max = Math.max(max, getVisualWidth(c) + 10); });
    }

    // 3. Footer width
    let footerText = '';
    switch (prompt.kind) {
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
          {prompt.kind === 'ask' && (
            <PromptBox
              title={apiKeyMode ? 'Enter API Key' : 'Notice'}
              body={prompt.message}
              input={apiKeyMode ? (apiKeyInput || prompt.value) : ''}
              footer={apiKeyMode ? 'Enter to Save • Esc to Cancel' : 'Enter to Close • Esc to Cancel'}
              width={contentWidth - 2}
              showInput={apiKeyMode}
            />
          )}
          {prompt.kind === 'confirm' && (
            <PromptBox
              title="Confirm Action"
              body={prompt.message}
              footer="Enter Confirm • Esc Cancel"
              width={contentWidth - 2}
            />
          )}
          {prompt.kind === 'selectOne' && (
            <SelectList
              title={prompt.message}
              choices={prompt.choices}
              selected={prompt.selected}
              footer="↑/↓ Navigate • Enter Select • Esc Cancel"
              width={contentWidth - 2}
            />
          )}
          {prompt.kind === 'selectMany' && (
            <SelectManyList
              title={prompt.message}
              choices={prompt.choices}
              selected={prompt.selected}
              picked={prompt.picked}
              footer="↑/↓ Move • Space Toggle • Enter Confirm • Esc Cancel"
              width={contentWidth - 2}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}

// Backward-compatible export while call sites are migrated.
export const PromptOverlay = ModalOverlay;

