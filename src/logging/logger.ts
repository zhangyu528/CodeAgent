import { appendFile } from "node:fs/promises";

export type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  private level: LogLevel;
  private logFilePath?: string;

  constructor(options?: { level?: LogLevel; logFilePath?: string }) {
    this.level = options?.level ?? this.resolveLevel();
    this.logFilePath = options?.logFilePath ?? process.env.LOG_FILE_PATH;
  }

  debug(message: string, meta?: unknown) {
    this.emit("debug", message, meta);
  }

  info(message: string, meta?: unknown) {
    this.emit("info", message, meta);
  }

  warn(message: string, meta?: unknown) {
    this.emit("warn", message, meta);
  }

  error(message: string, meta?: unknown) {
    this.emit("error", message, meta);
  }

  private emit(level: LogLevel, message: string, meta?: unknown) {
    if (levelOrder[level] < levelOrder[this.level]) {
      return;
    }
    const payload = meta ? `${message} ${this.safeSerialize(meta)}` : message;
    const line = `[${level}] ${payload}`;
    this.writeConsole(level, line);
    if (this.logFilePath) {
      void appendFile(this.logFilePath, `${line}\n`, "utf-8");
    }
  }

  private writeConsole(level: LogLevel, line: string) {
    if (level === "error") {
      console.error(line);
      return;
    }
    if (level === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  }

  private resolveLevel(): LogLevel {
    const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
    if (raw === "debug" || raw === "warn" || raw === "error") {
      return raw;
    }
    return "info";
  }

  private safeSerialize(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return "\"[unserializable]\"";
    }
  }
}
