'use strict';

const { stdin, stdout, stderr } = process;

let buffer = '';
let notifyInterval = null;

const handlers = {
  initialize: async (params) => {
    return {
      agent: 'node',
      capabilities: ['ping', 'echo', 'notify'],
      client: params && params.client ? params.client : null
    };
  },
  'agent/ping': async () => ({ ok: true, ts: Date.now() }),
  'agent/echo': async (params) => ({ echo: params || {} }),
  shutdown: async () => ({ ok: true })
};

function sendMessage(obj) {
  const line = JSON.stringify(obj);
  stdout.write(line + '\n');
}

function sendError(id, code, message, data) {
  const err = { code, message };
  if (data !== undefined) err.data = data;
  sendMessage({ id, error: err });
}

function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return;

  // Notification
  if (msg.method && msg.id === undefined) {
    // No-op for now
    return;
  }

  // Request
  if (msg.method && msg.id !== undefined) {
    const handler = handlers[msg.method];
    if (!handler) {
      sendError(msg.id, -32601, 'Method not found');
      return;
    }

    Promise.resolve()
      .then(() => handler(msg.params))
      .then((result) => sendMessage({ id: msg.id, result }))
      .catch((err) => {
        sendError(msg.id, -32000, err && err.message ? err.message : 'Internal error');
      });
    return;
  }

  // Response (ignore)
}

function startNotifyLoop() {
  if (notifyInterval) return;
  notifyInterval = setInterval(() => {
    sendMessage({ method: 'agent/notify', params: { event: 'heartbeat', ts: Date.now() } });
  }, 5000);
}

function stopNotifyLoop() {
  if (!notifyInterval) return;
  clearInterval(notifyInterval);
  notifyInterval = null;
}

stdin.setEncoding('utf8');
stdin.on('data', (chunk) => {
  buffer += chunk;
  let idx = buffer.indexOf('\n');
  while (idx !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line.length === 0) {
      idx = buffer.indexOf('\n');
      continue;
    }
    try {
      const msg = JSON.parse(line);
      handleMessage(msg);
      if (msg && msg.method === 'initialize') {
        startNotifyLoop();
      }
      if (msg && msg.method === 'shutdown') {
        stopNotifyLoop();
      }
    } catch (e) {
      sendError(null, -32700, 'Parse error');
    }
    idx = buffer.indexOf('\n');
  }
});

stdin.on('end', () => {
  stopNotifyLoop();
  stderr.write('[agent] stdin ended\n');
});

process.on('SIGTERM', () => {
  stopNotifyLoop();
  process.exit(0);
});

stderr.write('[agent] started\n');
