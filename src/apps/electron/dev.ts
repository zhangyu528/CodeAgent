/**
 * dev.ts — Development launcher for Electron + static server.
 *
 * Uses esbuild for main/preload, simple http server for renderer.
 * Usage: bun run electron:dev
 */
import { spawn, type ChildProcess } from 'child_process';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/apps/electron/ → project root: 3 levels up
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const rendererDir = path.join(projectRoot, 'src', 'apps', 'electron', 'renderer');
const PORT = 5173;

function buildWithEsbuild(
  entry: string,
  outfile: string,
  external: string[] = []
): Promise<boolean> {
  return new Promise(resolve => {
    // Windows: node_modules/.bin/esbuild is actually esbuild.exe (from npm/bun install)
    const isWindows = process.platform === 'win32';
    const esbuildBin = isWindows
      ? path.join(projectRoot, 'node_modules', '.bin', 'esbuild.exe')
      : path.join(projectRoot, 'node_modules', '.bin', 'esbuild');
    const args = [
      entry,
      '--bundle',
      '--platform=node',
      '--target=node22',
      '--format=esm',
      `--outfile=${outfile}`,
      ...external.flatMap(e => [`--external:${e}`]),
    ];
    const child = spawn(esbuildBin, args, { cwd: projectRoot, shell: true });
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
    child.on('close', code => resolve(code === 0));
  });
}

function startStaticServer(): Promise<{ close: () => void }> {
  return new Promise(resolve => {
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
    };
    const server = createServer((req, res) => {
      const urlPath = req.url === '/' ? 'index.html' : (req.url || 'index.html').slice(1);
      const filePath = path.join(rendererDir, urlPath);
      const ext = path.extname(filePath);
      import('fs').then(({ readFile }) => {
        readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
          res.end(data);
        });
      });
    });
    server.listen(PORT, () => {
      console.log(`[dev] Static server → http://localhost:${PORT}`);
      resolve({ close: () => server.close() });
    });
  });
}

async function main() {
  const mainOut = path.join(projectRoot, 'dist', 'electron', 'main.js');
  const preloadOut = path.join(projectRoot, 'dist', 'electron', 'preload.js');

  // 1. Build main.ts
  console.log('[dev] Building main.ts...');
  const mainOk = await buildWithEsbuild(
    path.join(projectRoot, 'src', 'apps', 'electron', 'main.ts'),
    mainOut,
    ['electron', '@mariozechner/pi-coding-agent', 'electron-log', 'winston']
  );
  if (!mainOk) {
    console.error('[dev] Build failed');
    process.exit(1);
  }
  console.log('[dev] Build done.');

  // 2. Build preload.ts
  console.log('[dev] Building preload.ts...');
  const preloadOk = await buildWithEsbuild(
    path.join(projectRoot, 'src', 'apps', 'electron', 'preload.ts'),
    preloadOut,
    ['electron']
  );
  if (!preloadOk) {
    console.error('[dev] Preload build failed');
    process.exit(1);
  }
  console.log('[dev] Preload done.');

  // 3. Start static server
  const { close: closeServer } = await startStaticServer();

  // 4. Start Electron
  // On Windows, .bin contains electron.exe directly (not electron.cmd)
  const isWindows = process.platform === 'win32';
  const electronBin = isWindows
    ? path.join(projectRoot, 'node_modules', '.bin', 'electron.exe')
    : process.platform === 'darwin'
      ? 'electron'
      : 'electron';
  // WSL headless workaround — switches go BEFORE main.js (for electron, not node)
  const isWSL = process.platform !== 'win32' && process.platform !== 'darwin';
  const electronArgs = [
    ...(isWSL ? ['--disable-dev-shm', '--disable-gpu', '--no-sandbox'] : []),
    mainOut,
  ];
  const electronProc: ChildProcess = spawn(electronBin, electronArgs, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      ...(isWSL ? { ELECTRON_OZONE_PLATFORM_HINT: '1' } : {}),
    },
  });

  electronProc.on('close', code => {
    closeServer();
    process.exit(code ?? 0);
  });
}

main().catch(err => {
  console.error('[dev] Fatal:', err);
  process.exit(1);
});
