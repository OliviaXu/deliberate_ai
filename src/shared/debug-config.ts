import type { DebugConfig, LogLevel } from './types';

const LEVELS: LogLevel[] = ['off', 'error', 'info', 'debug'];

function parseLevel(raw: string | null): LogLevel {
  if (!raw) return 'info';
  return LEVELS.includes(raw as LogLevel) ? (raw as LogLevel) : 'info';
}

export function loadDebugConfig(win: Window = window): DebugConfig {
  const enabled = win.localStorage.getItem('deliberate.debug.enabled') === 'true';
  const level = parseLevel(win.localStorage.getItem('deliberate.debug.level'));
  return { enabled, level };
}
