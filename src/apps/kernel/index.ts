import * as dotenv from 'dotenv';
import * as readline from 'readline';
import * as util from 'util';
import { IPC_UIAdapter } from './adapter';
import { createAgent } from '../cli/components/factory'; // Reusing factory for core setup
import { JsonRpcRequest } from './protocol';

/**
 * 1. PURE STDOUT MODE
 * We must redirect all console calls to stderr to keep stdout 
 * reserved exclusively for structured JSON-RPC messages.
 */
const originalStdout = process.stdout;
console.log = (...args: any[]) => process.stderr.write(util.format(...args) + '\n');
console.error = (...args: any[]) => process.stderr.write(util.format(...args) + '\n');
console.warn = (...args: any[]) => process.stderr.write(util.format(...args) + '\n');
console.info = (...args: any[]) => process.stderr.write(util.format(...args) + '\n');

export async function main() {
    process.stderr.write('[Kernel] Starting...\n');
    dotenv.config({ quiet: true });

    // 2. Initialize Kernel UI Adapter
    const ui = new IPC_UIAdapter(originalStdout);

    // 3. Initialize Core (using existing factory for now, but pointing to IUIAdapter)
    process.stderr.write('[Kernel] Initializing Core...\n');
    const { controller, engine } = await createAgent(ui);
    process.stderr.write('[Kernel] Core Initialized.\n');

    // 4. Listen for JSON-RPC over STDIN
    const rl = readline.createInterface({
        input: process.stdin,
        terminal: false
    });

    rl.on('line', async (line) => {
        if (!line.trim()) return;

        try {
            const msg: any = JSON.parse(line);

            // Handle Response to Core Request
            if (msg.result !== undefined || msg.error !== undefined) {
                ui.handleResponse(msg);
                return;
            }

            // Handle Incoming Request (macOS -> Core)
            if (msg.method) {
                const req = msg as JsonRpcRequest;
                await handleRequest(req, controller, ui);
            }
        } catch (e: any) {
            process.stderr.write(`Error parsing STDIN: ${e.message}\n`);
            originalStdout.write(JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32700, message: 'Parse error' },
                id: null
            }) + '\n');
        }
    });

    // Notify App that Kernel is ready
    originalStdout.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'kernel.ready',
        params: { version: '1.0.0' }
    }) + '\n');
}

async function handleRequest(req: JsonRpcRequest, controller: any, ui: IPC_UIAdapter) {
    try {
        switch (req.method) {
            case 'chat': {
                const prompt = req.params.prompt;
                // Run in background, results streamed via ui.onStream
                controller.run(prompt).catch((err: any) => {
                    ui.error(`Run Error: ${err.message}`);
                });
                sendResult(req.id, { ok: true });
                break;
            }
            case 'chat.stream': {
                const prompt = req.params.prompt;
                controller.askStream(prompt).catch((err: any) => {
                    ui.error(`Stream Error: ${err.message}`);
                });
                sendResult(req.id, { ok: true });
                break;
            }
            case 'status': {
                sendResult(req.id, {
                    provider: controller.getProviderName(),
                    model: controller.getModelName(),
                    workspace: controller.getAuthorizedPath()
                });
                break;
            }
            case 'exit': {
                sendResult(req.id, { goodbye: true });
                process.exit(0);
                break;
            }
            default:
                sendError(req.id, -32601, 'Method not found');
        }
    } catch (e: any) {
        sendError(req.id, -32603, e.message);
    }
}

function sendResult(id: string | number, result: any) {
    originalStdout.write(JSON.stringify({
        jsonrpc: '2.0',
        result,
        id
    }) + '\n');
}

function sendError(id: string | number, code: number, message: string) {
    originalStdout.write(JSON.stringify({
        jsonrpc: '2.0',
        error: { code, message },
        id
    }) + '\n');
}

if (require.main === module) {
    main().catch(err => {
        process.stderr.write(`Fatal Error: ${err.message}\n`);
        process.exit(1);
    });
}
