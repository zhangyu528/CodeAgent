'use strict';

const { spawn } = require('child_process');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { count: 200, maxChunk: 32, seed: null, agent: 'index.js' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--count') opts.count = parseInt(args[++i], 10);
    else if (a === '--max-chunk') opts.maxChunk = parseInt(args[++i], 10);
    else if (a === '--seed') opts.seed = parseInt(args[++i], 10);
    else if (a === '--agent') opts.agent = args[++i];
  }
  return opts;
}

function createRng(seed) {
  if (seed == null || Number.isNaN(seed)) {
    return Math.random;
  }
  let s = seed >>> 0;
  return function () {
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17; s >>>= 0;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

function makeMessages(count) {
  const msgs = [];
  for (let i = 0; i < count; i++) {
    msgs.push({ id: String(i + 1), method: 'agent/echo', params: { msg: `hello-${i}` } });
  }
  return msgs;
}

function chunkify(lines, maxChunk, rng) {
  const chunks = [];
  let current = '';
  for (const line of lines) {
    // randomly decide to split the line into pieces
    let remaining = line;
    while (remaining.length > 0) {
      const size = Math.max(1, Math.min(remaining.length, Math.floor(rng() * maxChunk) + 1));
      const piece = remaining.slice(0, size);
      remaining = remaining.slice(size);
      if (rng() < 0.5) {
        current += piece;
      } else {
        chunks.push(current + piece);
        current = '';
      }
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function run() {
  const opts = parseArgs();
  const rng = createRng(opts.seed);

  const agentPath = opts.agent;
  const child = spawn('node', [agentPath], { stdio: ['pipe', 'pipe', 'inherit'] });

  let responses = 0;
  let buffer = '';

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let idx = buffer.indexOf('\n');
    while (idx !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) {
        responses += 1;
      }
      idx = buffer.indexOf('\n');
    }
  });

  child.on('exit', (code) => {
    console.log(`agent exited: ${code}`);
  });

  const lines = makeMessages(opts.count).map((m) => JSON.stringify(m) + '\n');
  const chunks = chunkify(lines, opts.maxChunk, rng);

  for (const c of chunks) {
    child.stdin.write(c);
  }
  child.stdin.end();

  const checkInterval = setInterval(() => {
    if (responses >= opts.count) {
      console.log(`ok: responses=${responses} requests=${opts.count}`);
      clearInterval(checkInterval);
      child.kill();
    }
  }, 100);
}

run();
