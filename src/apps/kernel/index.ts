import * as dotenv from 'dotenv';
import * as readline from 'readline';
import * as util from 'util';
import { IPC_UIAdapter } from './adapter';
import { createAgent } from '../cli/components/factory';
import { JsonRpcRequest } from './protocol';

const originalStdout = process.stdout;
console.log = (...args: any[]) => process.stderr.write(util.format(...args) + '\n');
console.error = (...args: any[]) => process.stderr.write(util.format(...args) + '\n');
console.warn = (...args: any[]) => process.stderr.write(util.format(...args) + '\n');
console.info = (...args: any[]) => process.stderr.write(util.format(...args) + '\n');

export async function main() {
  process.stderr.write('[Kernel] Starting...\n');
  dotenv.config({ quiet: true });

  const ui = new IPC_UIAdapter(originalStdout);

  process.stderr.write('[Kernel] Initializing Core...\n');
  const { controller } = await createAgent(ui);
  process.stderr.write('[Kernel] Core Initialized.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });

  rl.on('line', async (line) => {
    if (!line.trim()) return;

    try {
      const msg: any = JSON.parse(line);

      if (msg.result !== undefined || msg.error !== undefined) {
        ui.handleResponse(msg);
        return;
      }

      if (msg.method) {
        const req = msg as JsonRpcRequest;
        await handleRequest(req, controller, ui);
      }
    } catch (e: any) {
      process.stderr.write(`Error parsing STDIN: ${e.message}\n`);
      originalStdout.write(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error' },
        id: null,
      }) + '\n');
    }
  });

  originalStdout.write(JSON.stringify({
    jsonrpc: '2.0',
    method: 'kernel.ready',
    params: { version: '1.0.0' },
  }) + '\n');
}

async function handleRequest(req: JsonRpcRequest, controller: any, ui: IPC_UIAdapter) {
  try {
    switch (req.method) {
      case 'chat': {
        const prompt = req.params.prompt;
        controller.run(prompt).catch((err: any) => {
          ui.error(`Run Error: ${err.message}`);
        });
        sendResult(req.id, { ok: true });
        break;
      }
      case 'chat.stream': {
        const prompt = req.params.prompt;
        const sessionId = req.params.sessionId;
        controller.askStream(prompt, { sessionId }).catch((err: any) => {
          ui.error(`Stream Error: ${err.message}`);
        });
        sendResult(req.id, { ok: true });
        break;
      }
      case 'session.start': {
        const initialPrompt = req.params?.initialPrompt;
        const created = controller.createNewSession(initialPrompt);
        sendResult(req.id, { sessionId: created?.sessionId || null });
        break;
      }
      case 'session.resume': {
        const sessionId = String(req.params?.sessionId || '');
        const resumed = controller.resumeSession(sessionId);
        sendResult(req.id, resumed);
        break;
      }
      case 'session.listRecent': {
        const limit = Number(req.params?.limit || 10);
        sendResult(req.id, { sessions: controller.listRecentSessions(limit) });
        break;
      }
      case 'session.end': {
        if (req.params?.sessionId) {
          controller.resumeSession(String(req.params.sessionId));
        }
        controller.endCurrentSession();
        sendResult(req.id, { ok: true });
        break;
      }
      case 'status': {
        sendResult(req.id, {
          provider: controller.getProviderName(),
          model: controller.getModelName(),
          workspace: controller.getAuthorizedPath(),
        });
        break;
      }
      case 'exit': {
        controller.endCurrentSession();
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
  originalStdout.write(JSON.stringify({ jsonrpc: '2.0', result, id }) + '\n');
}

function sendError(id: string | number, code: number, message: string) {
  originalStdout.write(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id }) + '\n');
}

const isMain = Boolean(process.argv[1]) && import.meta.url.endsWith(process.argv[1]!.replace(/\\\\/g, '/'));
if (isMain) {
  main().catch(err => {
    process.stderr.write(`Fatal Error: ${err.message}\n`);
    process.exit(1);
  });
}