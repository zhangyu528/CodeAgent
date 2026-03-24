import React from 'react';
import { Box } from 'ink';
import { ChoicePrompt } from './types.js';
import { PromptBox } from './prompt_box.js';
import { SelectList } from './select_list.js';
import { SelectManyList } from './select_many_list.js';

export type PromptOverlayProps = {
  prompt: ChoicePrompt;
  columns: number;
  rows: number;
};

export function PromptOverlay({ prompt, columns, rows }: PromptOverlayProps) {
  if (prompt.kind === 'none') return null;

  const popupWidth = Math.min(columns - 10, 80);
  
  return (
    <Box 
      position="absolute" 
      width={columns} 
      height={rows} 
      alignItems="center" 
      justifyContent="center"
    ><Box 
          flexDirection="column" 
          width={popupWidth} 
          paddingX={0} 
          paddingY={0}
          borderStyle="round"
          borderColor="cyan"
          backgroundColor="black"
      >{prompt.kind === 'ask' && <PromptBox title="Input" body={prompt.message} input={prompt.value} footer="Enter 提交，Esc 取消" />}{prompt.kind === 'confirm' && <PromptBox title="Confirm" body={prompt.message} footer="Y/Enter 确认，N/Esc 取消" />}{prompt.kind === 'selectOne' && (
          <SelectList
              title={prompt.message}
              choices={prompt.choices}
              selected={prompt.selected}
              footer="↑/↓ 选择，Enter 确认"
          />
          )}{prompt.kind === 'selectMany' && (
          <SelectManyList
              title={prompt.message}
              choices={prompt.choices}
              selected={prompt.selected}
              picked={prompt.picked}
              footer="↑/↓ 移动，Space 勾选，Enter 确认"
          />
          )}</Box></Box>
  );
}
