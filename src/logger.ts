import { config } from "./config.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: number;

  constructor() {
    this.level = levels[config.LOG_LEVEL];
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (levels[level] < this.level) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    console[level === "debug" ? "log" : level](prefix, message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log("debug", message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log("info", message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log("warn", message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log("error", message, ...args);
  }
}

export const logger = new Logger();
