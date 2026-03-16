import * as fs from 'fs/promises';
import * as path from 'path';

function toPosix(p: string) {
  return p.replace(/\\/g, '/');
}

function splitTokens(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

export function buildCompleter(opts: {
  cwd: string;
  slashCommands: string[];
  getModelProviders?: () => string[];
}): (line: string, callback: (err: any, result: [string[], string]) => void) => void {
  const slash = [...opts.slashCommands].sort();

  return async (line, callback) => {
    try {
      const tokens = splitTokens(line);
      const lastToken = tokens.length > 0 ? tokens[tokens.length - 1]! : '';

      // /model provider completion
      if (tokens[0] === '/model' && tokens.length <= 2) {
        const providers = (opts.getModelProviders ? opts.getModelProviders() : []).sort();
        const partial = tokens.length === 2 ? tokens[1]! : '';
        const hits = providers.filter(p => p.startsWith(partial.toLowerCase()));
        return callback(null, [hits.length ? hits : providers, partial]);
      }

      if (lastToken.startsWith('/')) {
        const hits = slash.filter(c => c.startsWith(lastToken));
        return callback(null, [hits.length ? hits : slash, lastToken]);
      }

      // Path completion
      const raw = lastToken;
      const hasDir = raw.includes('/') || raw.includes('\\');

      const base = hasDir ? raw.replace(/[^/\\]+$/, '') : '';
      const partial = hasDir ? raw.slice(base.length) : raw;

      const baseFs = path.resolve(opts.cwd, base || '.');
      const entries = await fs.readdir(baseFs, { withFileTypes: true });

      const matches = entries
        .map(e => ({ name: e.name, isDir: e.isDirectory() }))
        .filter(e => e.name.toLowerCase().startsWith(partial.toLowerCase()))
        .map(e => {
          const suffix = e.isDir ? '/' : '';
          return toPosix(path.posix.join(toPosix(base), e.name + suffix));
        });

      return callback(null, [matches, raw]);
    } catch {
      return callback(null, [[], line]);
    }
  };
}
