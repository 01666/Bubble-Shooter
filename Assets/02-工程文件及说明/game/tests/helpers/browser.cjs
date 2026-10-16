const fs = require('node:fs'),
  path = require('node:path');
let modulePath;
try {
  modulePath = require.resolve('playwright-core');
} catch {
  const bundled = path.join(
    process.env.USERPROFILE || '',
    '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core',
  );
  if (!fs.existsSync(bundled))
    throw Error('Install test dependencies with npm ci, or set NODE_PATH to playwright-core.');
  modulePath = bundled;
}
const api = require(modulePath);
module.exports = {
  ...api,
  browserPath() {
    const candidates = [
      process.env.BROWSER_PATH,
      process.env.LOCALAPPDATA &&
        path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
      process.env.PROGRAMFILES &&
        path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
      process.env.PROGRAMFILES &&
        path.join(process.env.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe'),
    ].filter(Boolean);
    const found = candidates.find((p) => fs.existsSync(p));
    if (!found) throw Error('Set BROWSER_PATH to installed Chrome/Edge.');
    return found;
  },
};
