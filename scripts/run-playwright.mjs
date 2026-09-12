import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { homedir, platform } from 'node:os';

const requiredRevision = '1243';
const executableName = platform() === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
const configuredRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;
const roots = [
  configuredRoot,
  resolve('.playwright'),
  '/opt/data/.playwright',
  join(homedir(), '.cache', 'ms-playwright'),
].filter(Boolean);

function hasRequiredChromium(root) {
  const executable = join(
    root,
    `chromium_headless_shell-${requiredRevision}`,
    'chrome-headless-shell-linux64',
    executableName,
  );
  return existsSync(executable);
}

const browserRoot = roots.find(hasRequiredChromium);
if (!browserRoot) {
  const locations = roots.map((root) => {
    try {
      return `${root}: ${readdirSync(root).join(', ')}`;
    } catch {
      return `${root}: unavailable`;
    }
  });
  console.error(`Playwright Chromium revision ${requiredRevision} was not found.`);
  console.error(locations.join('\n'));
  process.exit(1);
}

const result = spawnSync('playwright', ['test', ...process.argv.slice(2)], {
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserRoot },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
