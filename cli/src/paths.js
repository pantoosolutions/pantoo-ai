import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// `--home <dir>` points the whole install at another profile, for clean-profile tests.
export function profile(home) {
  const root = home ? path.resolve(home) : os.homedir();
  return {
    home: root,
    claudeDir: path.join(root, '.claude'),
    configFile: path.join(root, '.pantoo', 'config.json'),
    // Passed to the `claude` CLI so it installs into the same profile.
    env: home ? { ...process.env, HOME: root, CLAUDE_CONFIG_DIR: path.join(root, '.claude') } : process.env,
  };
}
