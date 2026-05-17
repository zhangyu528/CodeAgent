/**
 * JSON-RPC Server Entry Point
 *
 * Starts the agent service with JSON-RPC over STDIO interface.
 * Used by WinUI clients.
 *
 * Usage: bun run src/agent-service/bin/rpc-server.ts
 */

import { createAgentService } from '../services/index.js';
import { createJsonRpcServer } from '../adapters/json-rpc.js';

createAgentService().then(service => {
  const rpcServer = createJsonRpcServer(service);
  rpcServer.start();
  console.log('[AgentService] JSON-RPC server ready');
}).catch(err => {
  console.error('[AgentService] Fatal error:', err);
  process.exit(1);
});