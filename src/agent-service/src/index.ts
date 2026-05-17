/**
 * Agent Service - Library Entry Point
 *
 * Usage:
 *   import { createAgentService } from './agent-service';  // Electron
 *   bun run src/agent-service/bin/rpc-server.ts             // WinUI JSON-RPC
 */

export { createAgentService } from './services/index.js';
export type { AgentService } from './services/types.js';
export { registerIpcHandlers } from './adapters/index.js';