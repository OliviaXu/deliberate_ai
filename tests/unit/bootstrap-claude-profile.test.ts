import { describe, expect, it } from 'vitest';
// This script is authored as `.mjs` and currently has no TypeScript source module.
// @ts-expect-error TS7016
import { getChromeArgs } from '../../scripts/bootstrap-claude-profile.mjs';

describe('bootstrap-claude-profile', () => {
  it('opens Claude in a dedicated profile while loading the unpacked extension', () => {
    const args = getChromeArgs({
      cdpPort: '9224',
      extensionPath: '/tmp/chrome-mv3',
      userDataDir: '/tmp/claude-profile'
    });

    expect(args).toContain('--remote-debugging-port=9224');
    expect(args).toContain('--user-data-dir=/tmp/claude-profile');
    expect(args).toContain('--load-extension=/tmp/chrome-mv3');
    expect(args).toContain('https://claude.ai/new');
    expect(args).not.toContain('--disable-extensions-except=/tmp/chrome-mv3');
  });
});
