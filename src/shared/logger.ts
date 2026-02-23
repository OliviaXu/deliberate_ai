import type { DebugConfig, LogLevel } from './types';

const PRIORITY: Record<LogLevel, number> = {
  off: 0,
  error: 1,
  info: 2,
  debug: 3
};

export class Logger {
  constructor(private readonly config: DebugConfig) {}

  error(message: string, meta?: unknown): void {
    this.emit('error', message, meta);
  }

  info(message: string, meta?: unknown): void {
    this.emit('info', message, meta);
  }

  debug(message: string, meta?: unknown): void {
    this.emit('debug', message, meta);
  }

  private emit(level: LogLevel, message: string, meta?: unknown): void {
    if (!this.config.enabled) return;
    if (PRIORITY[level] > PRIORITY[this.config.level]) return;

    const payload = meta === undefined ? message : `${message} ${JSON.stringify(meta)}`;

    if (level === 'error') {
      console.error(`[deliberate:${level}] ${payload}`);
      return;
    }

    console.log(`[deliberate:${level}] ${payload}`);
  }
}
