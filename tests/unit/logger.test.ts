import { describe, expect, it, vi } from 'vitest';
import { Logger } from '../../src/shared/logger';

describe('Logger', () => {
  it('logs when enabled and at/above threshold', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = new Logger({ enabled: true, level: 'info' });

    logger.info('hello', { ok: true });

    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('does not log when disabled', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = new Logger({ enabled: false, level: 'debug' });

    logger.debug('hidden');

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
