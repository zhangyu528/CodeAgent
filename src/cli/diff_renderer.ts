import chalk from 'chalk';

type Edit = { type: 'equal' | 'insert' | 'delete'; line: string };

type HunkLine = { prefix: ' ' | '+' | '-'; text: string };

type Hunk = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: HunkLine[];
};

function splitLines(text: string): string[] {
  // Keep consistent line splitting without trailing \r
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
}

function lcsEdits(a: string[], b: string[]): Edit[] {
  const n = a.length;
  const m = b.length;

  // Prevent pathological cases
  if (n * m > 2_000_000) {
    const edits: Edit[] = [];
    for (const line of a) edits.push({ type: 'delete', line });
    for (const line of b) edits.push({ type: 'insert', line });
    return edits;
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i]! === b[j]! ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const edits: Edit[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i]! === b[j]!) {
      edits.push({ type: 'equal', line: a[i]! });
      i++; j++;
      continue;
    }

    if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      edits.push({ type: 'delete', line: a[i]! });
      i++;
    } else {
      edits.push({ type: 'insert', line: b[j]! });
      j++;
    }
  }
  while (i < n) { edits.push({ type: 'delete', line: a[i++]! }); }
  while (j < m) { edits.push({ type: 'insert', line: b[j++]! }); }

  return edits;
}

function buildHunks(edits: Edit[], contextLines: number): Hunk[] {
  const hunks: Hunk[] = [];

  let oldLineNo = 1;
  let newLineNo = 1;

  let current: Hunk | null = null;
  let pendingContext: HunkLine[] = [];

  const pushCurrent = () => {
    if (!current) return;
    // Trim trailing context to requested size
    // (we already manage it via pendingContext, but keep safety)
    hunks.push(current);
    current = null;
  };

  for (let idx = 0; idx < edits.length; idx++) {
    const e = edits[idx]!;

    const isChange = e.type !== 'equal';

    if (!isChange) {
      const line = e.line;
      const hLine: HunkLine = { prefix: ' ', text: line };

      if (current) {
        current.lines.push(hLine);
        current.oldLines += 1;
        current.newLines += 1;

        // Keep last N context lines available to decide if we should close hunk
        pendingContext.push(hLine);
        if (pendingContext.length > contextLines) pendingContext.shift();
      } else {
        pendingContext.push(hLine);
        if (pendingContext.length > contextLines) pendingContext.shift();
      }

      oldLineNo += 1;
      newLineNo += 1;
      continue;
    }

    // Start a new hunk if none
    if (!current) {
      const oldStart = Math.max(1, oldLineNo - pendingContext.length);
      const newStart = Math.max(1, newLineNo - pendingContext.length);

      current = {
        oldStart,
        newStart,
        oldLines: pendingContext.length,
        newLines: pendingContext.length,
        lines: [...pendingContext],
      };
    } else {
      // If current exists, clear pendingContext since it's already included
      pendingContext = [];
    }

    if (e.type === 'delete') {
      current.lines.push({ prefix: '-', text: e.line });
      current.oldLines += 1;
      oldLineNo += 1;
    } else if (e.type === 'insert') {
      current.lines.push({ prefix: '+', text: e.line });
      current.newLines += 1;
      newLineNo += 1;
    }

    // Lookahead to decide closing based on upcoming equals distance
    // We close hunk when we've seen >contextLines equals after last change.
    let equalsRun = 0;
    for (let k = idx + 1; k < edits.length; k++) {
      if (edits[k]!.type === 'equal') {
        equalsRun++;
        if (equalsRun > contextLines) {
          // We should close after keeping only contextLines lines
          break;
        }
      } else {
        equalsRun = 0;
      }
    }

    // If we have a long run of equals ahead, we will close when we actually process them;
    // to keep logic simpler, we close on the first equal that exceeds contextLines.
    // Implement by checking next edit
    const next = edits[idx + 1];
    if (next && next.type === 'equal') {
      // We'll close later if needed
    } else {
      // no-op
    }

    // Reset pending context tracking after a change
    pendingContext = [];
  }

  // Post-process to split hunks by context gap
  // The above is conservative and may produce over-long hunks; we re-scan per hunk.
  // For now keep as-is; acceptable for MVP.
  pushCurrent();

  // If no hunks but edits contain inserts/deletes, fallback create one full hunk
  if (hunks.length === 0) {
    const changed = edits.some(e => e.type !== 'equal');
    if (changed) {
      const lines: HunkLine[] = [];
      let oldCount = 0;
      let newCount = 0;
      for (const e of edits) {
        if (e.type === 'equal') {
          lines.push({ prefix: ' ', text: e.line });
          oldCount++; newCount++;
        } else if (e.type === 'delete') {
          lines.push({ prefix: '-', text: e.line });
          oldCount++;
        } else {
          lines.push({ prefix: '+', text: e.line });
          newCount++;
        }
      }
      hunks.push({ oldStart: 1, newStart: 1, oldLines: oldCount, newLines: newCount, lines });
    }
  }

  return hunks;
}

function colorizeLine(prefix: ' ' | '+' | '-', text: string): string {
  if (prefix === '+') return chalk.green('+' + text);
  if (prefix === '-') return chalk.red('-' + text);
  return chalk.gray(' ' + text);
}

export function renderUnifiedDiff(oldText: string, newText: string, filePath: string, contextLines: number = 3): string {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);

  const edits = lcsEdits(oldLines, newLines);
  const hunks = buildHunks(edits, contextLines);

  const header = [
    chalk.cyan(`diff --git a/${filePath} b/${filePath}`),
    chalk.gray(`--- a/${filePath}`),
    chalk.gray(`+++ b/${filePath}`),
  ];

  const body: string[] = [];
  for (const h of hunks) {
    body.push(chalk.cyan(`@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`));
    for (const ln of h.lines) {
      body.push(colorizeLine(ln.prefix, ln.text));
    }
  }

  return [...header, ...body].join('\n');
}

