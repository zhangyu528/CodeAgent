import { IUIAdapter } from '../../core/interfaces/ui';
import { JsonRpcNotification, JsonRpcRequest, JsonRpcResponse } from './protocol';

/**
 * IPC_UIAdapter translates Core UI calls into JSON-RPC messages 
 * sent over STDOUT to a parent process (e.g. macOS App).
 */
export class IPC_UIAdapter implements IUIAdapter {
    private pendingRequests = new Map<string | number, (result: any) => void>();
    private nextId = 1000;

    constructor(private stdout: NodeJS.WriteStream) {}

    private send(msg: JsonRpcNotification | JsonRpcRequest | JsonRpcResponse) {
        this.stdout.write(JSON.stringify(msg) + '\n');
    }

    private request<T>(method: string, params: any): Promise<T> {
        const id = this.nextId++;
        const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
        
        return new Promise<T>((resolve) => {
            this.pendingRequests.set(id, resolve);
            this.send(req);
        });
    }

    /**
     * Handle incoming responses from the parent process.
     */
    handleResponse(res: JsonRpcResponse) {
        if (res.id === null) return;
        const resolver = this.pendingRequests.get(res.id);
        if (resolver) {
            this.pendingRequests.delete(res.id);
            resolver(res.result);
        }
    }

    // --- IUIAdapter Implementation ---

    onThink(text: string): void {
        this.send({ jsonrpc: '2.0', method: 'think', params: { text } });
    }

    onStream(token: string): void {
        this.send({ jsonrpc: '2.0', method: 'stream.chunk', params: { token } });
    }

    onToolStart(name: string, input: any): void {
        this.send({ jsonrpc: '2.0', method: 'tool.start', params: { name, input } });
    }

    onToolEnd(name: string, output: any): void {
        this.send({ jsonrpc: '2.0', method: 'tool.end', params: { name, output } });
    }

    onStatusUpdate(status: any): void {
        this.send({ jsonrpc: '2.0', method: 'status.update', params: status });
    }

    print(message: string): void {
        this.send({ jsonrpc: '2.0', method: 'ui.print', params: { message } });
    }

    error(message: string): void {
        this.send({ jsonrpc: '2.0', method: 'ui.error', params: { message } });
    }

    info(message: string): void {
        this.send({ jsonrpc: '2.0', method: 'ui.info', params: { message } });
    }

    async ask(question: string): Promise<string> {
        return this.request<string>('ui.ask', { question });
    }

    async confirm(message: string): Promise<boolean> {
        return this.request<boolean>('ui.confirm', { message });
    }

    async selectOne(message: string, choices: string[], opts?: { default?: string | undefined }): Promise<string> {
        return this.request<string>('ui.selectOne', { message, choices, ...opts });
    }

    async selectMany(message: string, choices: string[], opts?: { defaults?: string[] | undefined }): Promise<string[]> {
        return this.request<string[]>('ui.selectMany', { message, choices, ...opts });
    }

    async openEditor(message: string, initial?: string | undefined): Promise<string> {
        return this.request<string>('ui.openEditor', { message, initial });
    }

    async suspendInput<T>(fn: () => Promise<T>): Promise<T> {
        // In IPC mode, we don't necessarily have a "keyboard" to lock,
        // but we might want to signal the UI to disable input fields.
        this.send({ jsonrpc: '2.0', method: 'ui.suspend', params: { suspended: true } });
        try {
            return await fn();
        } finally {
            this.send({ jsonrpc: '2.0', method: 'ui.suspend', params: { suspended: false } });
        }
    }
}
