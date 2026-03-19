import { describe, expect, it, vi } from 'vitest';
import { createBackgroundTestClockController } from '../../src/background/test-clock';

describe('createBackgroundTestClockController', () => {
  it('returns the current override for content requests', async () => {
    const addListener = vi.fn();

    const controller = createBackgroundTestClockController({
      runtime: {
        onMessage: {
          addListener
        }
      }
    });

    const listener = addListener.mock.calls[0]?.[0];
    if (!listener) throw new Error('Expected runtime listener');

    const initialResponse = vi.fn();
    listener({ type: 'deliberate:clock:get' }, { tab: { id: 42 } }, initialResponse);

    expect(initialResponse).toHaveBeenCalledWith({ nowMs: null });

    await controller.setNowMs(1_800_000_000_000);

    const updatedResponse = vi.fn();
    listener({ type: 'deliberate:clock:get' }, { tab: { id: 42 } }, updatedResponse);

    expect(updatedResponse).toHaveBeenCalledWith({ nowMs: 1_800_000_000_000 });
  });

  it('clears the override when set to null', async () => {
    const addListener = vi.fn();

    const controller = createBackgroundTestClockController({
      runtime: {
        onMessage: {
          addListener
        }
      }
    });

    const listener = addListener.mock.calls[0]?.[0];
    if (!listener) throw new Error('Expected runtime listener');

    await controller.setNowMs(99);
    await controller.setNowMs(null);

    const sendResponse = vi.fn();
    listener({ type: 'deliberate:clock:get' }, { tab: { id: 8 } }, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ nowMs: null });
  });

  it('updates the in-memory override without extra background channels', async () => {
    const addListener = vi.fn();
    const controller = createBackgroundTestClockController({
      runtime: {
        onMessage: {
          addListener
        }
      }
    });

    await expect(controller.setNowMs(123)).resolves.toBeUndefined();
  });

  it('detaches the runtime listener on dispose', () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    const controller = createBackgroundTestClockController({
      runtime: {
        onMessage: {
          addListener,
          removeListener
        }
      }
    });

    const listener = addListener.mock.calls[0]?.[0];
    if (!listener) throw new Error('Expected runtime listener');

    controller.dispose();

    expect(removeListener).toHaveBeenCalledWith(listener);
  });

  it('installs the controller on the provided global scope during creation', () => {
    const globalScope: Record<string, unknown> = {};

    const controller = createBackgroundTestClockController(
      {
        runtime: {
          onMessage: {
            addListener: vi.fn()
          }
        }
      },
      globalScope
    );

    expect(globalScope.__deliberateTestClock).toBe(controller);
  });
});
