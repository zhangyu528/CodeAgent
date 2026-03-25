const { spawn } = require('child_process');
const path = require('path');

const kernelPath = path.join(__dirname, '../bin/codeagent-kernel.js');
const kernel = spawn('node', [kernelPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

console.log('[Test] Starting Kernel...');

let buffer = '';

kernel.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      console.log('[Kernel -> Client]', msg);

      if (msg.method === 'kernel.ready') {
        console.log('[Test] Kernel Ready. Sending status request...');
        const req = JSON.stringify({
          jsonrpc: '2.0',
          method: 'status',
          id: 1
        });
        kernel.stdin.write(req + '\n');
      } else if (msg.id === 1) {
        console.log('[Test] Status received:', msg.result);
        console.log('[Test] Exiting...');
        kernel.kill();
        process.exit(0);
      }
    } catch (e) {
      console.error('[Test] Parse Error:', e.message, line);
    }
  }
});

kernel.stderr.on('data', (data) => {
  console.log('[Kernel Log]', data.toString().trim());
});

kernel.on('close', (code) => {
  console.log(`[Test] Kernel exited with code ${code}`);
});
