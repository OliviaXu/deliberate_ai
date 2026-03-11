import { describe, expect, it } from 'vitest';
// This script is authored as `.mjs` and currently has no TypeScript source module.
// @ts-expect-error TS7016
import { getChromeArgs } from '../../scripts/bootstrap-gemini-profile.mjs';

describe('bootstrap-gemini-profile', () => {
  it('loads the unpacked extension without disabling other extensions', () => {
    const args = getChromeArgs({
      cdpPort: '9222',
      extensionPath: '/tmp/chrome-mv3',
      userDataDir: '/tmp/gemini-profile'
    });

    expect(args).toContain('--load-extension=/tmp/chrome-mv3');
    expect(args).not.toContain('--disable-extensions-except=/tmp/chrome-mv3');
  });
});
