/**
 * build-electron.js — Build script for Electron (main + preload).
 * Usage: node scripts/build-electron.js
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const external = [
  'electron',
  '@mariozechner/pi-coding-agent',
  'electron-log',
  'winston',
];

function build(entry, outfile, extraExternal = []) {
  return new Promise((resolve, reject) => {
    const args = [
      entry,
      '--bundle',
      '--platform=node',
      '--target=node22',
      '--format=esm',
      `--outfile=${outfile}`,
      ...[...external, ...extraExternal].flatMap((e) => [`--external:${e}`]),
    ];
    const bin = path.join(projectRoot, 'node_modules', '.bin', 'esbuild');
    const child = spawn(bin, args, { cwd: projectRoot, shell: true });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`esbuild failed with code ${code}`));
    });
  });
}

async function main() {
  const distElectron = path.join(projectRoot, 'dist', 'electron');

  console.log('[build] Compiling main.ts...');
  await build(
    path.join(projectRoot, 'src', 'apps', 'electron', 'main.ts'),
    path.join(distElectron, 'main.js'),
  );
  console.log('[build] main.js done.');

  console.log('[build] Compiling preload.ts...');
  await build(
    path.join(projectRoot, 'src', 'apps', 'electron', 'preload.ts'),
    path.join(distElectron, 'preload.js'),
    ['electron'],
  );
  console.log('[build] preload.js done.');

  console.log('[build] Electron build complete.');
}

main().catch((err) => {
  console.error('[build] Fatal:', err);
  process.exit(1);
});
