import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

type PackageSummaryMode = 'full' | 'count';

type BuildOptions = {
  maxTokens?: number;
  maxDepth?: number;
  ignore?: Set<string>;
};

export class ContextInformer {
  private readonly maxTokens: number;
  private readonly maxDepth: number;
  private readonly ignore: Set<string>;
  private readonly charsPerToken = 4;

  constructor(options?: BuildOptions) {
    this.maxTokens = options?.maxTokens ?? 500;
    this.maxDepth = options?.maxDepth ?? 2;
    this.ignore = options?.ignore ?? new Set([
      '.git',
      'node_modules',
      'dist',
      'build',
      'temp',
      'coverage'
    ]);
  }

  async buildBootSnapshot(rootDir: string): Promise<string> {
    const readmePath = await this.findReadme(rootDir);
    const readmeText = readmePath ? await this.safeReadFile(readmePath) : '';
    const packagePath = path.join(rootDir, 'package.json');
    const packageText = await this.safeReadFile(packagePath);
    const packageJson = packageText ? this.safeParseJson(packageText) : null;
    const treeLines = await this.buildTree(rootDir, this.maxDepth);

    let readmeMaxChars = 600;
    let treeMaxLines = 80;
    let packageMode: PackageSummaryMode = 'full';

    let snapshot = this.composeSnapshot({
      readmeText,
      readmeMaxChars,
      packageJson,
      packageMode,
      treeLines,
      treeMaxLines
    });

    if (this.estimateTokens(snapshot) > this.maxTokens) {
      readmeMaxChars = 300;
      snapshot = this.composeSnapshot({
        readmeText,
        readmeMaxChars,
        packageJson,
        packageMode,
        treeLines,
        treeMaxLines
      });
    }

    if (this.estimateTokens(snapshot) > this.maxTokens) {
      readmeMaxChars = 150;
      snapshot = this.composeSnapshot({
        readmeText,
        readmeMaxChars,
        packageJson,
        packageMode,
        treeLines,
        treeMaxLines
      });
    }

    if (this.estimateTokens(snapshot) > this.maxTokens) {
      treeMaxLines = 40;
      snapshot = this.composeSnapshot({
        readmeText,
        readmeMaxChars,
        packageJson,
        packageMode,
        treeLines,
        treeMaxLines
      });
    }

    if (this.estimateTokens(snapshot) > this.maxTokens) {
      treeMaxLines = 20;
      snapshot = this.composeSnapshot({
        readmeText,
        readmeMaxChars,
        packageJson,
        packageMode,
        treeLines,
        treeMaxLines
      });
    }

    if (this.estimateTokens(snapshot) > this.maxTokens) {
      packageMode = 'count';
      snapshot = this.composeSnapshot({
        readmeText,
        readmeMaxChars,
        packageJson,
        packageMode,
        treeLines,
        treeMaxLines
      });
    }

    if (this.estimateTokens(snapshot) > this.maxTokens) {
      snapshot = this.truncateToTokens(snapshot, this.maxTokens);
    }

    return snapshot.trim();
  }

  private composeSnapshot(params: {
    readmeText: string;
    readmeMaxChars: number;
    packageJson: any | null;
    packageMode: PackageSummaryMode;
    treeLines: string[];
    treeMaxLines: number;
  }): string {
    const sections: string[] = [];

    const readmeSummary = this.buildReadmeSummary(params.readmeText, params.readmeMaxChars);
    if (readmeSummary) {
      sections.push(`项目简介:\n${readmeSummary}`);
    }

    const packageSummary = this.buildPackageSummary(params.packageJson, params.packageMode);
    if (packageSummary) {
      sections.push(`技术栈与脚本:\n${packageSummary}`);
    }

    const treeSummary = this.buildTreeSummary(params.treeLines, params.treeMaxLines);
    if (treeSummary) {
      sections.push(`目录概览:\n${treeSummary}`);
    }

    if (sections.length === 0) {
      return '【项目引导快照】\n未发现 README 或 package.json，且目录为空。';
    }

    return `【项目引导快照】\n${sections.join('\n\n')}`;
  }

  private buildReadmeSummary(readmeText: string, maxChars: number): string {
    if (!readmeText) return '';
    const lines = readmeText.split(/\r?\n/).map(line => line.trim());
    const titleLine = lines.find(line => line.startsWith('#')) || lines.find(line => line.length > 0) || '';
    const title = titleLine.replace(/^#+\s*/, '').trim();

    const paragraphs: string[] = [];
    let current: string[] = [];
    for (const line of lines) {
      if (!line) {
        if (current.length > 0) {
          paragraphs.push(current.join(' '));
          current = [];
        }
        continue;
      }
      if (line.startsWith('#')) continue;
      current.push(line);
    }
    if (current.length > 0) paragraphs.push(current.join(' '));

    const description = paragraphs[0] || '';
    const merged = [
      title ? `标题：${title}` : '',
      description ? `简介：${description}` : ''
    ].filter(Boolean).join('\n');

    if (!merged) return '';
    return this.truncateToChars(merged, maxChars);
  }

  private buildPackageSummary(pkg: any | null, mode: PackageSummaryMode): string {
    if (!pkg || typeof pkg !== 'object') return '';
    const lines: string[] = [];
    const name = pkg.name || '';
    const version = pkg.version || '';
    const desc = pkg.description || '';
    const scripts = pkg.scripts ? Object.keys(pkg.scripts) : [];
    const deps = pkg.dependencies ? Object.keys(pkg.dependencies) : [];
    const devDeps = pkg.devDependencies ? Object.keys(pkg.devDependencies) : [];

    if (name || version) {
      lines.push(`项目：${name || 'unknown'}${version ? `@${version}` : ''}`);
    }
    if (desc) {
      lines.push(`描述：${desc}`);
    }
    if (scripts.length > 0) {
      lines.push(`脚本：${scripts.slice(0, 8).join(', ')}${scripts.length > 8 ? '...' : ''}`);
    }

    if (mode === 'full') {
      if (deps.length > 0) {
        lines.push(`依赖：${deps.slice(0, 8).join(', ')}${deps.length > 8 ? `... (共${deps.length}项)` : ''}`);
      }
      if (devDeps.length > 0) {
        lines.push(`开发依赖：${devDeps.slice(0, 8).join(', ')}${devDeps.length > 8 ? `... (共${devDeps.length}项)` : ''}`);
      }
    } else {
      if (deps.length > 0) {
        lines.push(`依赖：${deps.length} 项`);
      }
      if (devDeps.length > 0) {
        lines.push(`开发依赖：${devDeps.length} 项`);
      }
    }

    return lines.join('\n');
  }

  private buildTreeSummary(lines: string[], maxLines: number): string {
    if (lines.length === 0) return '';
    const selected = lines.slice(0, maxLines);
    const overflow = lines.length - selected.length;
    const suffix = overflow > 0 ? `\n... 另有 ${overflow} 项未显示` : '';
    return `${selected.join('\n')}${suffix}`;
  }

  private async buildTree(rootDir: string, maxDepth: number): Promise<string[]> {
    const lines: string[] = [];
    const walk = async (dir: string, depth: number) => {
      if (depth >= maxDepth) return;
      let entries: fs.Dirent[];
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      const filtered = entries.filter(entry => !this.ignore.has(entry.name));
      filtered.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const entry of filtered) {
        const prefix = '  '.repeat(depth);
        const label = entry.isDirectory() ? `${entry.name}/` : entry.name;
        lines.push(`${prefix}- ${label}`);
        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          await walk(path.join(dir, entry.name), depth + 1);
        }
      }
    };

    await walk(rootDir, 0);
    return lines;
  }

  private async findReadme(rootDir: string): Promise<string | null> {
    const preferred = path.join(rootDir, 'README.md');
    if (await this.exists(preferred)) return preferred;
    try {
      const entries = await fsp.readdir(rootDir, { withFileTypes: true });
      const candidates = entries
        .filter(entry => entry.isFile() && /^README.*\.md$/i.test(entry.name))
        .map(entry => entry.name)
        .sort((a, b) => a.localeCompare(b));
      const first = candidates[0];
      if (first) {
        return path.join(rootDir, first);
      }
    } catch {
      return null;
    }
    return null;
  }

  private async safeReadFile(filePath: string): Promise<string> {
    try {
      return await fsp.readFile(filePath, 'utf-8');
    } catch {
      return '';
    }
  }

  private safeParseJson(text: string): any | null {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / this.charsPerToken);
  }

  private truncateToChars(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return `${text.slice(0, Math.max(0, maxChars - 1))}…`;
  }

  private truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = maxTokens * this.charsPerToken;
    return this.truncateToChars(text, maxChars);
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}




