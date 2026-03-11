import { spawn } from "node:child_process";
import path from "node:path";

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export interface ExecutionContext {
  cmd: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
}

export type ExecutionInterceptor = (context: ExecutionContext) => void;

const repoRoot = process.cwd();

function resolveCwd(cwd?: string): string {
  const resolved = cwd ? path.resolve(repoRoot, cwd) : repoRoot;
  const relative = path.relative(repoRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Command cwd is outside the workspace.");
  }
  return resolved;
}

export async function runCommand(
  cmd: string,
  args: string[] = [],
  options?: {
    cwd?: string;
    timeoutMs?: number;
    interceptors?: ExecutionInterceptor[];
  }
): Promise<ExecutionResult> {
  const timeoutMs = options?.timeoutMs ?? defaultTimeoutMs();
  const cwd = resolveCwd(options?.cwd);
  const context: ExecutionContext = { cmd, args, cwd, timeoutMs };

  for (const interceptor of options?.interceptors ?? []) {
    interceptor(context);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode: code, timedOut });
    });
  });
}

function defaultTimeoutMs(): number {
  const raw = process.env.EXEC_TIMEOUT_MS;
  if (!raw) {
    return 30_000;
  }
  const value = Number(raw);
  if (Number.isNaN(value) || value <= 0) {
    return 30_000;
  }
  return value;
}
