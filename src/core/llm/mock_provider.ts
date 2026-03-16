import { LLMProvider, Message, GenerateOptions, LLMResponse } from './provider';

type ToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

function makeToolCall(name: string, args: any, id: string): ToolCall {
  return {
    id,
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  };
}

function lastIndexOfRole(messages: Message[], role: Message['role']): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === role) return i;
  }
  return -1;
}

function getLastUser(messages: Message[]): { idx: number; content: string } {
  const idx = lastIndexOfRole(messages, 'user');
  return { idx, content: idx >= 0 ? String(messages[idx]!.content || '') : '' };
}

function countToolMessagesSince(messages: Message[], idx: number): number {
  if (idx < 0) return messages.filter(m => m.role === 'tool').length;
  let n = 0;
  for (let i = idx + 1; i < messages.length; i++) {
    if (messages[i]?.role === 'tool') n++;
  }
  return n;
}

function extractBetween(text: string, left: string, right: string): string {
  const i = text.indexOf(left);
  if (i < 0) return '';
  const j = text.indexOf(right, i + left.length);
  if (j < 0) return '';
  return text.slice(i + left.length, j);
}

function parseObjectiveFromPlannerPrompt(prompt: string): string {
  const m = prompt.match(/Objective:\s*"([\s\S]*?)"/);
  return (m?.[1] || '').trim();
}

function planForObjective(objective: string): any {
  const obj = objective || '';

  if (obj.includes("temp/p1_dist") && obj.includes('info.txt')) {
    return {
      objective: obj,
      steps: [
        { id: 1, description: "Create directory temp/p1_dist" },
        { id: 2, description: "Create file temp/p1_dist/info.txt with content 'Hello from Planner'" },
        { id: 3, description: "List directory temp/p1_dist" },
      ],
    };
  }

  if (obj.toLowerCase().includes('non_existent.txt') && obj.toLowerCase().includes('package.json')) {
    return {
      objective: obj,
      steps: [
        { id: 1, description: "Read file non_existent.txt" },
        { id: 2, description: "Read file package.json" },
        { id: 3, description: "Tell me the version from package.json" },
      ],
    };
  }

  // Generic fallback
  return {
    objective: obj,
    steps: [
      { id: 1, description: 'Analyze the objective' },
      { id: 2, description: 'Execute with available tools' },
      { id: 3, description: 'Summarize the outcome' },
    ],
  };
}

export class MockProvider implements LLMProvider {
  name = 'mock';

  async generate(messages: Message[], _tools?: any[], _options?: GenerateOptions): Promise<LLMResponse> {
    const { idx: userIdx, content: userText } = getLastUser(messages);
    const toolsSinceUser = countToolMessagesSince(messages, userIdx);

    // Planner: createPlan / replanRemaining (expects JSON only)
    if (userText.includes('Please output the plan in the following JSON format')) {
      const objective = parseObjectiveFromPlannerPrompt(userText);
      const plan = planForObjective(objective);
      return { message: { role: 'assistant', content: JSON.stringify(plan) } };
    }

    if (userText.includes('Please create a REVISED plan of remaining steps')) {
      const objective = extractBetween(userText, 'The original objective was: "', '"');
      const plan = planForObjective(objective);
      return { message: { role: 'assistant', content: JSON.stringify({ steps: plan.steps }) } };
    }


    // F8 diff preview tests
    if (userText.includes('F8_DIFF_TEST_WRITE')) {
      if (toolsSinceUser === 0) {
        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [makeToolCall('write_file', { filePath: 'temp/f8_diff_test.txt', content: 'Hello from diff test' }, 'call_f8_write')],
          },
        };
      }
      return { message: { role: 'assistant', content: 'F8 diff write test done.' } };
    }

    if (userText.includes('F8_DIFF_TEST_REPLACE')) {
      if (toolsSinceUser === 0) {
        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [makeToolCall('replace_content', { filePath: 'temp/f8_replace_test.txt', targetContent: 'OLD', replacementContent: 'NEW' }, 'call_f8_replace')],
          },
        };
      }
      return { message: { role: 'assistant', content: 'F8 diff replace test done.' } };
    }
    // AgentController integration test (fixed task)
    if (userText.includes('Please list all files in the current directory') && userText.includes('write a summary')) {
      if (toolsSinceUser === 0) {
        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [makeToolCall('run_command', { command: 'dir', timeout: 30000 }, 'call_dir')],
          },
        };
      }

      if (toolsSinceUser === 1) {
        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [makeToolCall('read_file', { filePath: 'package.json' }, 'call_read_pkg')],
          },
        };
      }

      if (toolsSinceUser === 2) {
        const lastToolIdx = lastIndexOfRole(messages, 'tool');
        const pkgText = lastToolIdx >= 0 ? String(messages[lastToolIdx]!.content || '') : '';
        let version = '';
        try {
          version = JSON.parse(pkgText)?.version || '';
        } catch {
          version = '';
        }

        const outputFilePath = 'temp/test_run_output.txt';
        const summary = `package.json version: ${version || '(unknown)'}\nGenerated by MockProvider.`;

        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [makeToolCall('write_file', { filePath: outputFilePath, content: summary }, 'call_write_summary')],
          },
        };
      }

      return {
        message: {
          role: 'assistant',
          content: 'Done. Listed files, read package.json, and wrote the summary to temp/test_run_output.txt.',
        },
      };
    }

    // Planner.executePlan uses controller.run with this format
    if (userText.includes('Your current task is:')) {
      const task = userText.split('Your current task is:').slice(1).join('Your current task is:').trim();

      // Step-local 2-turn pattern: tool -> final answer
      if (toolsSinceUser >= 1) {
        return { message: { role: 'assistant', content: 'Step completed.' } };
      }

      if (/^Create directory temp\/p1_dist/i.test(task)) {
        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [makeToolCall('run_command', { command: 'mkdir temp\\p1_dist', timeout: 30000 }, 'call_mkdir')],
          },
        };
      }

      if (task.includes("temp/p1_dist/info.txt") && task.includes('Hello from Planner')) {
        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [makeToolCall('write_file', { filePath: 'temp/p1_dist/info.txt', content: 'Hello from Planner' }, 'call_write_info')],
          },
        };
      }

      if (/^List directory temp\/p1_dist/i.test(task)) {
        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [makeToolCall('run_command', { command: 'dir temp\\p1_dist', timeout: 30000 }, 'call_dir_p1')],
          },
        };
      }

      if (task.toLowerCase().startsWith('read file ')) {
        const file = task.slice('Read file '.length).trim();
        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [makeToolCall('read_file', { filePath: file }, 'call_read_generic')],
          },
        };
      }

      if (task.toLowerCase().includes('tell me the version')) {
        // Best effort: if package.json was read in this step, parse it.
        const lastToolIdx = lastIndexOfRole(messages, 'tool');
        const pkgText = lastToolIdx >= 0 ? String(messages[lastToolIdx]!.content || '') : '';
        let version = '';
        try {
          version = JSON.parse(pkgText)?.version || '';
        } catch {
          version = '';
        }
        return { message: { role: 'assistant', content: `package.json version: ${version || '(unknown)'}` } };
      }

      // Fallback: do nothing
      return { message: { role: 'assistant', content: 'No-op.' } };
    }


    // Security path guard test
    if (userText.includes("Read the file") && userText.includes(".env")) {
      const m = userText.match(/Read the file\s+'([^']+)'/i);
      const filePath = (m?.[1] || '').trim();

      if (toolsSinceUser === 0) {
        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [makeToolCall('read_file', { filePath }, 'call_read_sensitive')],
          },
        };
      }

      return {
        message: {
          role: 'assistant',
          content: `Security check complete. If the path is outside workspace, it should be blocked: ${filePath}`,
        },
      };
    }

    // E2E multi-step task
    if (userText.includes("Search for 'GLMProvider'") && userText.includes("create a file 'temp/comp_test.txt'")) {
      if (toolsSinceUser === 0) {
        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [makeToolCall('file_search', { query: 'GLMProvider', includeFiles: '*.ts' }, 'call_search_glm')],
          },
        };
      }
      if (toolsSinceUser === 1) {
        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [makeToolCall('list_directory', { directoryPath: 'src/tools' }, 'call_list_tools')],
          },
        };
      }
      if (toolsSinceUser === 2) {
        return {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [makeToolCall('write_file', { filePath: 'temp/comp_test.txt', content: 'I found everything' }, 'call_write_comp')],
          },
        };
      }
      return { message: { role: 'assistant', content: 'Completed mocked multi-step task.' } };
    }

    return {
      message: {
        role: 'assistant',
        content: 'MockProvider: no matching scenario.',
      },
    };
  }
}




