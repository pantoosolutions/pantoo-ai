import { spawnSync } from 'node:child_process';

// Quotes one argument for cmd.exe. `"` and `%` can't be escaped reliably there, so they throw.
export function winQuote(a) {
  if (/["%]/.test(a)) throw new Error(`Cannot pass an argument containing " or % through cmd.exe: ${a}`);
  return /^[\w@+=:,./\\#-]+$/.test(a) ? a : `"${a}"`;
}

// On Windows, npm CLIs (claude, npx) are .cmd shims that only start through the shell, and Node
// passes a shell command's arguments unquoted. So there the command goes as one quoted string.
export function spawn(cmd, args, opts = {}) {
  if (process.platform !== 'win32') return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return spawnSync([cmd, ...args].map(winQuote).join(' '), { encoding: 'utf8', ...opts, shell: true });
}
