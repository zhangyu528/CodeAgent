/**
 * JSON-RPC 2.0 Protocol Types for the Bridge
 */

export type JsonRpcRequest = {
    jsonrpc: '2.0';
    method: string;
    params?: any;
    id: string | number;
};

export type JsonRpcResponse = {
    jsonrpc: '2.0';
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
    id: string | number | null;
};

export type JsonRpcNotification = {
    jsonrpc: '2.0';
    method: string;
    params?: any;
};

// --- Outgoing Notifications (Core -> App) ---

export type StreamChunkNotification = {
    method: 'stream.chunk';
    params: { token: string };
};

export type StatusUpdateNotification = {
    method: 'status.update';
    params: any;
};

export type ToolStartNotification = {
    method: 'tool.start';
    params: { name: string; input: any };
};

export type ToolEndNotification = {
    method: 'tool.end';
    params: { name: string; output: any };
};

// --- Outgoing Requests (Core -> App, reverse call) ---

export type UIConfirmRequest = {
    method: 'ui.confirm';
    params: { message: string };
};

export type UIAskRequest = {
    method: 'ui.ask';
    params: { question: string };
};

export type UISelectRequest = {
    method: 'ui.select';
    params: { message: string, choices: string[], defaults?: string[] };
};
