import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readIfExists, sameText, writeFile } from './files.js';
import { spawn } from './spawn.js';

export const MACHINE_RULE = 'machine.md';
export const MACHINE_HEADER = 'Written by `npx pantoo-ai doctor`';
// Rules from the hand-written era that machine.md replaces.
export const OLD_MACHINE_RULES = ['mac-dev-environment.md', 'windows-dev-environment.md'];

const GIT_BASH_CANDIDATES = (env) => [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  env.LOCALAPPDATA && path.win32.join(env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe'),
].filter(Boolean);

function probe(cmd, args) {
  const r = spawn(cmd, args, { timeout: 10000 });
  return r.error || r.status !== 0 ? null : `${r.stdout}${r.stderr}`.trim();
}

// Everything the detection touches, injectable so tests can describe a Windows or a Mac machine.
export function realSystem() {
  const win = process.platform === 'win32';
  return {
    platform: process.platform,
    arch: process.arch,
    env: process.env,
    nodeVersion: process.versions.node,
    nodePath: process.execPath,
    exists: (f) => fs.existsSync(f),
    // The first line of `cmd args`, or null when it is missing or fails.
    run: (cmd, args) => probe(cmd, args)?.split('\n')[0] ?? null,
    // First match of `where` / `which`.
    which: (cmd) => probe(win ? 'where' : 'which', [cmd])?.split(/\r?\n/)[0] ?? null,
    osVersion: () => (process.platform === 'darwin' ? probe('sw_vers', ['-productVersion']) : null) ?? os.release(),
  };
}

const OS_NAME = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' };

function nodeManager(sys) {
  const { env, nodePath, which } = sys;
  const under = (needle) => nodePath.toLowerCase().includes(needle);
  if (env.FNM_DIR || env.FNM_MULTISHELL_PATH || under('fnm_multishells') || under('fnm')) return { name: 'fnm', path: which('fnm') };
  if (env.VOLTA_HOME || under('volta')) return { name: 'volta', path: which('volta') };
  if (env.NVM_HOME || (env.NVM_DIR && under('.nvm')) || under('nvm')) return { name: 'nvm', path: null };
  if (under('.asdf')) return { name: 'asdf', path: which('asdf') };
  return { name: null, path: nodePath };
}

// The Python command that really works. A Microsoft Store stub (WindowsApps) answers `python` but
// is not an interpreter.
function python(sys) {
  const tries = sys.platform === 'win32' ? [['python'], ['python3'], ['py', '-3']] : [['python3'], ['python']];
  for (const [cmd, ...args] of tries) {
    const where = sys.which(cmd);
    if (!where || /WindowsApps/i.test(where)) continue;
    const v = sys.run(cmd, [...args, '--version']);
    const m = v?.match(/Python (\d+\.\d+\.\d+)/);
    if (m) return { command: [cmd, ...args].join(' '), version: m[1], path: where };
  }
  return null;
}

function gitBash(sys) {
  const fromEnv = sys.env.CLAUDE_CODE_GIT_BASH_PATH;
  if (fromEnv && sys.exists(fromEnv)) return fromEnv;
  const found = GIT_BASH_CANDIDATES(sys.env).find((f) => sys.exists(f));
  if (found) return found;
  // git.exe sits in <root>\cmd or <root>\bin; bash.exe is in <root>\bin.
  const git = sys.which('git');
  const root = git && path.win32.dirname(path.win32.dirname(git));
  const derived = root && path.win32.join(root, 'bin', 'bash.exe');
  return derived && sys.exists(derived) ? derived : null;
}

export function detectMachine(sys = realSystem()) {
  const win = sys.platform === 'win32';
  const info = {
    os: OS_NAME[sys.platform] ?? sys.platform,
    osVersion: sys.osVersion(),
    arch: sys.arch,
    node: { version: sys.nodeVersion, ...nodeManager(sys) },
    python: python(sys),
    gitBash: win ? gitBash(sys) : null,
    brewPrefix: null,
  };
  if (sys.platform === 'darwin') info.brewPrefix = sys.exists('/opt/homebrew/bin/brew') ? '/opt/homebrew' : sys.exists('/usr/local/bin/brew') ? '/usr/local' : null;
  return info;
}

// Facts first, then only the consequences that change how commands should be written.
// How to load each Node manager's environment in a fresh shell, per shell. Volta and nvm-windows put
// node on PATH themselves, so they need nothing.
const LOAD_ENV = {
  fnm: { bash: 'eval "$(fnm env)"', powershell: 'fnm env --use-on-cd --shell power-shell | Out-String | Invoke-Expression' },
  nvm: { bash: '. "$NVM_DIR/nvm.sh"' },
  asdf: { bash: '. "$HOME/.asdf/asdf.sh"' },
};

export function renderMachine(info) {
  const win = info.os === 'Windows';
  const lines = [
    '# This machine',
    '',
    `${MACHINE_HEADER} from what it detected. Edits are overwritten; rerun doctor after`,
    'changing the setup.',
    '',
    `- OS: ${info.os} ${info.osVersion}, ${info.arch}`,
  ];
  if (info.brewPrefix) lines.push(`- Homebrew prefix: \`${info.brewPrefix}\`${info.brewPrefix === '/usr/local' ? ' (Intel Mac, not `/opt/homebrew`)' : ''}`);
  const nm = info.node;
  lines.push(`- Node ${nm.version}${nm.name ? `, managed by ${nm.name}` : `, from \`${nm.path}\``}`);
  lines.push(info.python ? `- Python ${info.python.version}: the command is \`${info.python.command}\` (${info.python.path})` : '- Python: not found');
  if (win) lines.push(`- Git Bash: ${info.gitBash ? `\`${info.gitBash}\`` : 'not found; Claude Code needs it on Windows (install Git for Windows)'}`);

  lines.push('', '## What this changes', '');
  if (nm.name) {
    lines.push(`- ${nm.name} owns Node. Never install a second Node manager; if a tool reports no \`node\`, its environment is scrubbed, so load ${nm.name}'s environment first.`);
    const load = LOAD_ENV[nm.name] ?? {};
    const shells = win ? [['Git Bash', load.bash], ['PowerShell', load.powershell]] : [['the shell', load.bash]];
    for (const [shell, cmd] of shells) if (cmd && !(win && nm.name === 'nvm')) lines.push(`  In ${shell}: \`${cmd}\``);
  } else {
    lines.push('- Node comes from a plain install. Do not add a Node manager without asking.');
  }
  if (info.python) lines.push(`- Run Python as \`${info.python.command}\`${win ? '; `python3` may not exist here' : ''}.`);
  if (win) {
    lines.push('- The Bash tool runs Git Bash: use POSIX syntax and forward-slash paths there. Use PowerShell syntax only when a command is run through PowerShell.');
    lines.push('- npm CLIs are `.cmd` shims; call them by name (`npx`, `claude`), not by file path.');
    lines.push('- Windows PowerShell 5.1 writes UTF-8 with a BOM (`Set-Content -Encoding UTF8`, `Out-File`), which breaks JSON and some config files. Write them with `[IO.File]::WriteAllText($path, $text)` (no BOM), from Git Bash, or with the Write tool.');
  }
  return `${lines.join('\n')}\n`;
}

// Writes the rule when it is missing or stale; a file that isn't the kit's is left alone ('foreign'). Returns what happened, for a doctor row.
export function writeMachineRule(claudeDir, info) {
  const file = path.join(claudeDir, 'rules', MACHINE_RULE);
  const text = renderMachine(info);
  const current = readIfExists(file);
  if (current !== null && !current.includes(MACHINE_HEADER)) return 'foreign';
  if (sameText(current, text)) return 'unchanged';
  writeFile(file, text);
  return current === null ? 'written' : 'updated';
}
