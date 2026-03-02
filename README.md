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
