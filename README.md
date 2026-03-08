# deliberate_ai

A browser assistant for the AI era that nudges you to think first, then builds stronger problem-solving through reflection and retrospectives.

## Run on Chrome (Extension Dev Mode)

1. Install deps:
   ```bash
   npm install
   ```
2. Build the extension:
   ```bash
   npm run build
   ```
3. Open Chrome at `chrome://extensions`.
4. Turn on **Developer mode**.
5. Click **Load unpacked** and select:
   `<repo-root>/.output/chrome-mv3` (for example, `deliberate_ai/.output/chrome-mv3`)
6. Open `https://gemini.google.com` and test.

After code changes, run `npm run build` again, then click **Reload** on the extension card in `chrome://extensions`.

## Gemini E2E Smoke Test

This flow uses your signed-in Chrome profile and attaches Playwright to that live browser over Chrome DevTools Protocol.

### One-Time Profile Setup

1. Create the repo-local Chrome profile directory:
   ```bash
   mkdir -p .pw-profiles/gemini
   ```
2. Keep `.pw-profiles/` out of git.
   The repo already ignores it in `.gitignore`.
3. Launch the dedicated Gemini browser once:
   ```bash
   npm run gemini:open
   ```
4. In that Chrome window, sign into `https://gemini.google.com`.
5. Keep using that same repo-local profile for future Gemini smoke runs.

The profile lives at `.pw-profiles/gemini`, so Gemini auth state stays isolated from your normal daily Chrome profile.

1. Build the extension:
   ```bash
   npm run build
   ```
2. Launch the dedicated Gemini test browser:
   ```bash
   npm run gemini:open
   ```
3. In that Chrome window, sign into `https://gemini.google.com` if needed and leave the window open.
4. Run the live Gemini smoke test:
   ```bash
   npm run test:e2e:gemini
   ```
5. After rebuilding the extension code, reload the unpacked extension in that same Chrome session:
   ```bash
   npm run gemini:reload-extension
   ```

Notes:
- The launcher uses the repo-local profile at `.pw-profiles/gemini`.
- The smoke test always starts from a fresh `https://gemini.google.com/app` tab so stale modal state does not leak across runs.
- If Playwright cannot attach, make sure Chrome is still running with remote debugging on port `9222`.
- `gemini:reload-extension` only reloads the unpacked extension already loaded in the attached Chrome session. It does not switch that session to a different worktree.
- To switch worktrees, quit the dedicated Chrome session from worktree A, `cd` into worktree B, run `npm run build`, then run `npm run gemini:open` from worktree B. You do not need to manually remove and re-add the extension card in Chrome; you need a fresh dedicated Chrome session tied to the new worktree.

## Debugging Logs and Storage

1. On `https://gemini.google.com`, open DevTools -> **Console** and run:
   ```js
   localStorage.setItem('deliberate.debug.enabled', 'true');
   localStorage.setItem('deliberate.debug.level', 'debug');
   location.reload();
   ```
2. After reload, check **Console** for `[deliberate:*]` logs.
3. To visually inspect extension storage, open `chrome://extensions` -> **Deliberate AI** -> **Service worker**.
4. In that DevTools window, open **Application** -> **Extension storage** (local) and inspect key:
   - `deliberate.learningCycles.v1`
