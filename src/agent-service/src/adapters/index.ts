/**
 * Adapters - Entry Point
 */

export { createJsonRpcServer } from './json-rpc.js';
export { createElectronIpcAdapter, registerIpcHandlers } from './electron-ipc.js';