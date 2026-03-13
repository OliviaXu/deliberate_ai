import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function getChromeArgs({ cdpPort, extensionPath, userDataDir }) {
  return [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    `--load-extension=${extensionPath}`,
    '--no-first-run',
    '--no-default-browser-check',
    'https://gemini.google.com'
  ];
}

export function main() {
  const projectRoot = process.cwd();
  const userDataDir = path.resolve(projectRoot, process.env.GEMINI_USER_DATA_DIR || '.pw-profiles/gemini');
  const extensionPath = path.resolve(projectRoot, '.output/chrome-mv3');
  const cdpPort = process.env.GEMINI_CDP_PORT || '9222';

  if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
    console.error(`Extension build not found at ${extensionPath}. Run "npm run build" first.`);
    process.exit(1);
  }

  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeBinary =
    process.env.GEMINI_CHROME_BINARY ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chromeArgs = getChromeArgs({
    cdpPort,
    extensionPath,
    userDataDir
  });

  if (!fs.existsSync(chromeBinary)) {
    console.error(`Google Chrome binary not found at ${chromeBinary}.`);
    process.exit(1);
  }

  const child = spawn(chromeBinary, chromeArgs, {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.exit(code);
    }
  });

  console.log(`Opened Google Chrome with profile ${userDataDir}.`);
  console.log(`CDP endpoint: http://127.0.0.1:${cdpPort}`);
  console.log('Sign into Gemini in that Chrome window, then keep it open while tests run.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
