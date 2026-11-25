import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

// One git call: run from the home folder, so Windows never finds a git.exe that a clone put in the
// repo. Pathspecs are literal. Returns { ok, out, err }.
export function git(dir, args, { cwd = os.homedir(), input } = {}) {
  const r = spawnSync('git', ['--literal-pathspecs', '-C', dir, ...args], { cwd: fs.existsSync(cwd) ? cwd : os.homedir(), input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.status === 0 ? r.stdout : '', err: r.stderr ?? String(r.error ?? '') };
}

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
