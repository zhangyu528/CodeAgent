import { AgentTool } from '@mariozechner/pi-agent-core';
import { readFileTool, readFileToolDefinition } from './read_file.js';
import { writeFileTool, writeFileToolDefinition } from './write_file.js';
import { runCommandTool, runCommandToolDefinition } from './run_command.js';
import { listDirectoryTool, listDirectoryToolDefinition } from './list_directory.js';
import { searchFilesTool, searchFilesToolDefinition } from './search_files.js';
import { ToolRegistry } from './registry.js';

// ToolRegistry validates all tool definitions at startup.
// If any definition is invalid, an error is thrown and the app will not start.
export const toolRegistry = new ToolRegistry();

toolRegistry.register(readFileToolDefinition);
toolRegistry.register(writeFileToolDefinition);
toolRegistry.register(runCommandToolDefinition);
toolRegistry.register(listDirectoryToolDefinition);
toolRegistry.register(searchFilesToolDefinition);

export const allTools: AgentTool<any>[] = [
  readFileTool,
  writeFileTool,
  runCommandTool,
  listDirectoryTool,
  searchFilesTool,
];
