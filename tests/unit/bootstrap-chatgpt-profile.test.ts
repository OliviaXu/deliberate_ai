import { describe, expect, it } from 'vitest';
// This script is authored as `.mjs` and currently has no TypeScript source module.
// @ts-expect-error TS7016
import { getChromeArgs } from '../../scripts/bootstrap-chatgpt-profile.mjs';

describe('bootstrap-chatgpt-profile', () => {
  it('opens ChatGPT in a dedicated profile while loading the unpacked extension', () => {
    const args = getChromeArgs({
      cdpPort: '9223',
      extensionPath: '/tmp/chrome-mv3',
      userDataDir: '/tmp/chatgpt-profile'
    });

    expect(args).toContain('--remote-debugging-port=9223');
    expect(args).toContain('--user-data-dir=/tmp/chatgpt-profile');
    expect(args).toContain('--load-extension=/tmp/chrome-mv3');
    expect(args).toContain('https://chatgpt.com');
    expect(args).not.toContain('--disable-extensions-except=/tmp/chrome-mv3');
  });
});
