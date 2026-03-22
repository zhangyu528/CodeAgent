import { readFileTool } from './read_file.js';
import { writeFileTool } from './write_file.js';
import { runCommandTool } from './run_command.js';
import { listDirectoryTool } from './list_directory.js';

export const allTools = [
  readFileTool,
  writeFileTool,
  runCommandTool,
  listDirectoryTool,
];
