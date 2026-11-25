import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// One git call: run from the home folder, so Windows never finds a git.exe that a clone put in the
// repo. Pathspecs are literal. `check-ignore` takes plain paths and refuses the flag (it then fails
// as if nothing were ignored). Returns { ok, out, err }.
export function git(dir, args, { cwd = os.homedir(), input } = {}) {
  const literal = args[0] === 'check-ignore' ? [] : ['--literal-pathspecs'];
  const r = spawnSync('git', [...literal, '-C', path.resolve(dir), ...args], { cwd: fs.existsSync(cwd) ? cwd : os.homedir(), input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.status === 0 ? r.stdout : '', err: r.stderr ?? String(r.error ?? '') };
}

// Quotes one argument for cmd.exe. `"` and `%` can't be escaped reliably there, so they throw.
export function winQuote(a) {
  if (/["%]/.test(a)) throw new Error(`Cannot pass an argument containing " or % through cmd.exe: ${a}`);
  return /^[\w@+=:,./\\#-]+$/.test(a) ? a : `"${a}"`;
}

// Windows looks for a program in the current folder before PATH, so a clone could bring its own
// claude.cmd or curl.bat. Commands run from the home folder unless a caller passes `cwd`, and the
// variable stops cmd.exe searching the current folder, for them and for the programs they start.
export function spawnOptions(opts = {}) {
  return {
    encoding: 'utf8',
    ...opts,
    cwd: opts.cwd ?? os.homedir(),
    env: { ...(opts.env ?? process.env), NoDefaultCurrentDirectoryInExePath: '1' },
  };
}

// On Windows, npm CLIs (claude, npx) are .cmd shims that only start through the shell, and Node
// passes a shell command's arguments unquoted. So there the command goes as one quoted string.
export function spawn(cmd, args, opts = {}) {
  if (process.platform !== 'win32') return spawnSync(cmd, args, spawnOptions(opts));
  return spawnSync([cmd, ...args].map(winQuote).join(' '), { ...spawnOptions(opts), shell: true });
}
