import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { doctor, machineChecks, pythonUsers, tasteChecks } from '../src/doctor.js';
import { applyKit, install, target } from '../src/install.js';
import { MACHINE_RULE, detectMachine, findBrowser, renderMachine, writeMachineRule } from '../src/machine.js';
import { profile } from '../src/paths.js';
import { claudeBinaryChecks, ghChecks, playwrightChecks, setupChecks, shellRcChecks, windowsChecks } from '../src/setup-checks.js';
import { winQuote } from '../src/spawn.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-mc-'));
const system = (over = {}) => ({
  platform: 'darwin', arch: 'x64', env: {}, nodeVersion: '22.1.0', nodePath: '/usr/local/bin/node',
  exists: () => false, run: () => null, output: () => null, which: () => null, read: () => null, size: () => null,
  realpath: (f) => f, list: () => [], osVersion: () => '26.6', ...over,
});

const mac = () => system({
  env: { FNM_DIR: '/x' },
  exists: (f) => f === '/usr/local/bin/brew',
  which: (c) => ({ fnm: '/usr/local/bin/fnm', python3: '/usr/local/bin/python3' })[c] ?? null,
  run: (c) => (c === 'python3' ? 'Python 3.13.2' : null),
});

const BASH = 'C:\\Program Files\\Git\\bin\\bash.exe';
const win = (over = {}) => system({
  platform: 'win32', arch: 'x64', osVersion: () => '10.0.26100', nodePath: 'C:\\Users\\j\\AppData\\Local\\fnm_multishells\\1\\node.exe',
  env: { LOCALAPPDATA: 'C:\\Users\\j\\AppData\\Local' },
  exists: (f) => f === BASH,
  which: (c) => ({ python: 'C:\\Python313\\python.exe', fnm: 'C:\\fnm\\fnm.exe' })[c] ?? null,
  run: (c) => (c === 'python' ? 'Python 3.13.2' : null),
  ...over,
});

test('Intel Mac: Homebrew prefix, fnm, python3', () => {
  const info = detectMachine(mac());
  assert.equal(info.os, 'macOS');
  assert.equal(info.brewPrefix, '/usr/local');
  assert.equal(info.node.name, 'fnm');
  assert.equal(info.python.command, 'python3');
  assert.equal(info.gitBash, null);
  const text = renderMachine(info);
  assert.match(text, /Intel Mac/);
  assert.doesNotMatch(text, /Git Bash|BOM/);
  assert.match(text, /In the shell: `eval "\$\(fnm env\)"`/);
});

test('Windows: Git Bash found, python not python3, fnm from the multishell path', () => {
  const info = detectMachine(win());
  assert.equal(info.gitBash, BASH);
  assert.equal(info.python.command, 'python');
  assert.equal(info.node.name, 'fnm');
  const text = renderMachine(info);
  assert.match(text, /Git Bash: `C:\\Program Files\\Git\\bin\\bash.exe`/);
  assert.match(text, /python3` may not exist/);
  assert.match(text, /In PowerShell: `fnm env --use-on-cd --shell power-shell/);
  assert.match(text, /In Git Bash: `eval "\$\(fnm env\)"`/);
  assert.match(text, /with a BOM/);
});

test('the Microsoft Store python stub is skipped; py -3 is not tried when python works', () => {
  const stub = win({ which: (c) => (c === 'python' ? 'C:\\Users\\j\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe' : null) });
  assert.equal(detectMachine(stub).python, null);
  assert.match(renderMachine(detectMachine(stub)), /Python: not found/);
});

test('Git Bash is derived from git.exe when it is not in a default place', () => {
  const custom = 'D:\\Tools\\Git\\bin\\bash.exe';
  const info = detectMachine(win({ exists: (f) => f === custom, which: (c) => (c === 'git' ? 'D:\\Tools\\Git\\cmd\\git.exe' : null) }));
  assert.equal(info.gitBash, custom);
});

test('CLAUDE_CODE_GIT_BASH_PATH wins when it exists', () => {
  const mine = 'E:\\bash.exe';
  const info = detectMachine(win({ env: { CLAUDE_CODE_GIT_BASH_PATH: mine }, exists: (f) => f === mine || f === BASH }));
  assert.equal(info.gitBash, mine);
});

test('writeMachineRule writes, then reports unchanged, then updates', () => {
  const claudeDir = tmp();
  const info = detectMachine(mac());
  assert.equal(writeMachineRule(claudeDir, info), 'written');
  assert.equal(writeMachineRule(claudeDir, info), 'unchanged');
  assert.equal(writeMachineRule(claudeDir, detectMachine(win())), 'updated');
  assert.ok(fs.existsSync(path.join(claudeDir, 'rules', MACHINE_RULE)));
});

test('doctor: missing Git Bash on Windows fails, missing python warns', () => {
  const prof = profile(tmp());
  const none = machineChecks(prof, detectMachine(win({ exists: () => false, which: () => null })));
  assert.equal(none.find((c) => c.what === 'Git Bash').level, 'fail');
  assert.equal(none.find((c) => c.what === 'python').level, 'warn');
  const ok = machineChecks(prof, detectMachine(win()));
  assert.ok(ok.every((c) => c.level === 'ok'));
});

test('user-scope settings get the Git Bash path on Windows only, and keep an existing one', () => {
  const file = (prof) => path.join(prof.claudeDir, 'settings.json');
  const prof = profile(tmp());
  const t = target('user', prof, tmp());
  applyKit(t, { files: {} }, { options: [], machine: detectMachine(win()) });
  assert.equal(JSON.parse(fs.readFileSync(file(prof), 'utf8')).env.CLAUDE_CODE_GIT_BASH_PATH, BASH);

  const prof2 = profile(tmp());
  fs.mkdirSync(prof2.claudeDir, { recursive: true });
  fs.writeFileSync(file(prof2), JSON.stringify({ env: { CLAUDE_CODE_GIT_BASH_PATH: 'E:\\bash.exe' } }));
  applyKit(target('user', prof2, tmp()), { files: {} }, { options: [], machine: detectMachine(win()) });
  assert.equal(JSON.parse(fs.readFileSync(file(prof2), 'utf8')).env.CLAUDE_CODE_GIT_BASH_PATH, 'E:\\bash.exe');

  const prof3 = profile(tmp());
  applyKit(target('user', prof3, tmp()), { files: {} }, { options: [], machine: detectMachine(mac()) });
  assert.ok(!fs.existsSync(file(prof3)) || !JSON.parse(fs.readFileSync(file(prof3), 'utf8')).env);

  const proj = tmp();
  const prof4 = profile(tmp());
  applyKit(target('project', prof4, proj), { files: {} }, { options: [], machine: detectMachine(win()) });
  assert.equal(JSON.parse(fs.readFileSync(path.join(proj, '.claude', 'settings.json'), 'utf8')).env, undefined);
});

test('winQuote leaves plain arguments and quotes spaces and quotes', () => {
  assert.equal(winQuote('pantoo@pantoo-ai'), 'pantoo@pantoo-ai');
  assert.equal(winQuote('owner/repo#abc123'), 'owner/repo#abc123');
  assert.equal(winQuote('E:\\Pantoo Solutions\\pantoo-ai'), '"E:\\Pantoo Solutions\\pantoo-ai"');
  assert.throws(() => winQuote('a"b'), /cmd\.exe/);
  assert.throws(() => winQuote('%PATH%'), /cmd\.exe/);
});

test('writeMachineRule leaves a rule that is not the kit\'s alone; doctor warns; remove skips it', () => {
  const claudeDir = tmp();
  const file = path.join(claudeDir, 'rules', MACHINE_RULE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '# my own notes\n');
  const info = detectMachine(mac());
  assert.equal(writeMachineRule(claudeDir, info), 'foreign');
  assert.equal(fs.readFileSync(file, 'utf8'), '# my own notes\n');
  const row = machineChecks({ claudeDir }, info).find((c) => c.what === 'rule machine.md');
  assert.equal(row.level, 'warn');
  assert.match(row.note, /left alone/);
});

test('a local marketplace is passed to claude as an absolute path', () => {
  const run = (cmd, args) => { run.calls.push(args); return { ok: true, out: '' }; };
  run.calls = [];
  const cwd = process.cwd();
  const dir = tmp();
  process.chdir(dir);
  try {
    install({ prof: profile(tmp()), options: [], marketplace: '.', packs: [], run });
  } finally { process.chdir(cwd); }
  assert.ok(path.isAbsolute(run.calls[0][3]));
  assert.equal(fs.realpathSync(run.calls[0][3]), fs.realpathSync(dir));
});

test('taste needs Node 22 and a browser, but only a copy with a page checker', () => {
  const root = tmp();
  const scripts = path.join(root, 'design-taste-frontend', 'scripts');
  fs.mkdirSync(scripts, { recursive: true });
  assert.deepEqual(tasteChecks([root], mac()), []);
  fs.writeFileSync(path.join(scripts, 'gate.mjs'), '');
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const ok = tasteChecks([tmp(), root], system({ exists: (f) => f === chrome }));
  assert.deepEqual(ok.map((c) => [c.level, c.note]), [['ok', ''], ['ok', chrome]]);
  const bad = tasteChecks([root], system({ nodeVersion: '20.19.0' }));
  assert.deepEqual(bad.map((c) => c.level), ['warn', 'warn']);
  assert.match(bad[0].note, /this is 20\.19\.0.*22 or newer/);
  assert.match(bad[1].note, /CHROME_PATH/);
  // doctor looks in the project's skills too.
  const dir = tmp();
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.renameSync(root, path.join(dir, '.claude', 'skills'));
  const rows = doctor(profile(tmp()), dir, { user: false, system: system() });
  assert.ok(rows.some((c) => c.what === 'browser for taste'));
});

test('findBrowser: Edge on Windows, a per-user Chrome, CHROME_PATH first, nothing elsewhere', () => {
  const found = (files, over) => findBrowser(win({ exists: (f) => files.includes(f), ...over }));
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  assert.equal(found([edge]), edge);
  const local = 'C:\\Users\\j\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
  assert.equal(found([edge, local]), local);
  assert.equal(found([edge, 'D:\\b.exe'], { env: { CHROME_PATH: 'D:\\b.exe' } }), 'D:\\b.exe');
  assert.equal(found([]), null);
  assert.equal(findBrowser(system({ platform: 'linux', exists: (f) => f === '/usr/bin/chromium' })), '/usr/bin/chromium');
  assert.equal(findBrowser(system({ platform: 'freebsd', exists: () => true })), null);
});

// A machine made of the files and command results given.
const fake = (base, { files = {}, dirs = {}, commands = {}, ...over } = {}) => {
  const result = (cmd, args) => commands[[cmd, ...args].join(' ')] ?? null;
  return base({
    exists: (f) => f in files, read: (f) => files[f] ?? null, size: (f) => files[f]?.length ?? null,
    list: (d) => dirs[d] ?? [], run: (c, a) => result(c, a)?.split('\n')[0] ?? null, output: result, ...over,
  });
};
const levels = (rows) => rows.map((c) => [c.level, c.what]);

test('python fails only when an installed skill runs on it', () => {
  const root = tmp();
  assert.deepEqual(pythonUsers([root]), []);
  fs.mkdirSync(path.join(root, 'ui-ux-pro-max'));
  const info = detectMachine(mac());
  const needs = { pythonFor: pythonUsers([tmp(), root]) };
  const row = machineChecks(profile(tmp()), { ...info, python: null }, needs).find((c) => c.what === 'python');
  assert.equal(row.level, 'fail');
  assert.match(row.note, /ui-ux-pro-max runs on it; install Python 3/);
  assert.ok(!machineChecks(profile(tmp()), info, needs).some((c) => c.what === 'python'));
});

test('gh: missing, logged out, logged in, on both systems', () => {
  for (const base of [system, win]) {
    assert.match(ghChecks(fake(base, { which: () => null }))[0].note, /cli\.github\.com/);
    const which = () => '/bin/gh';
    assert.match(ghChecks(fake(base, { which }))[0].note, /gh auth login/);
    const [row] = ghChecks(fake(base, { which, commands: { 'gh auth status': 'github.com\n  Logged in as someone' } }));
    assert.deepEqual([row.level, row.note], ['ok', 'logged in']);
  }
});

const REG = 'reg query HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem /v LongPathsEnabled';
const REPO = 'D:\\work\\site';
const repoCommands = (autocrlf) => ({
  [`git -C ${REPO} config --get core.autocrlf`]: autocrlf,
  [`git -C ${REPO} rev-parse --show-toplevel`]: REPO,
});

test('Windows: long paths, npm script-shell and core.autocrlf each get a fix', () => {
  assert.deepEqual(windowsChecks(mac()), []);
  const bad = windowsChecks(fake(win, { commands: { ...repoCommands('true'), 'npm config get script-shell': 'null' } }), { dir: REPO, gitBash: BASH });
  assert.deepEqual(levels(bad), [['warn', 'Windows long paths'], ['warn', 'npm script-shell'], ['warn', 'core.autocrlf']]);
  assert.match(bad[0].note, /git config --global core\.longpaths true.*reg add .*LongPathsEnabled/);
  assert.ok(bad[1].note.includes(`npm config set script-shell "${BASH}"`));
  assert.match(bad[2].note, /\.gitattributes/);
  const good = windowsChecks(fake(win, {
    commands: {
      ...repoCommands('true'),
      'git config --get core.longpaths': 'true',
      [REG]: 'HKEY_LOCAL_MACHINE\\SYSTEM\n    LongPathsEnabled    REG_DWORD    0x1',
      'npm config get script-shell': BASH,
    },
    files: { [`${REPO}\\.gitattributes`]: '* text=auto eol=lf\n' },
  }), { dir: REPO, gitBash: BASH });
  assert.ok(good.every((c) => c.level === 'ok'), JSON.stringify(good));
});

test('shell rc files: an unguarded --use-on-cd warns with the line to use', () => {
  const rc = (home, files) => shellRcChecks(fake(system, { files }), home);
  const [row] = rc('/h', { '/h/.zshrc': 'eval "$(fnm env --use-on-cd)"\n' });
  assert.deepEqual([row.level, row.what], ['warn', '~/.zshrc']);
  assert.match(row.note, /if \[ -n "\$CLAUDECODE" \].*--shell zsh/);
  assert.deepEqual(rc('/h', { '/h/.bashrc': '# eval "$(fnm env --use-on-cd)"\neval "$(fnm env)"\n' }), []);
  // The line doctor suggests passes its own check.
  const fixed = row.note.slice(row.note.indexOf('if [ -n'));
  assert.deepEqual(rc('/h', { '/h/.zshrc': `${fixed}\n` }), []);
  const onWindows = shellRcChecks(fake(win, { files: { 'C:\\Users\\j\\.bashrc': 'eval "$(fnm env --use-on-cd --shell bash)"' } }), 'C:\\Users\\j');
  assert.match(onWindows[0].note, /--shell bash/);
});

const STUB = 'echo "Error: claude native binary not installed." >&2\nexit 1\n';

test('the placeholder claude binary fails, behind a Windows shim or a Mac link', () => {
  const pkg = 'C:\\npm\\node_modules\\@anthropic-ai\\claude-code';
  const [row] = claudeBinaryChecks(fake(win, { which: () => 'C:\\npm\\claude.cmd', files: { [`${pkg}\\bin\\claude.exe`]: STUB } }));
  assert.equal(row.level, 'fail');
  assert.ok(row.note.includes(`\`node install.cjs\` in ${pkg}`), row.note);
  const real = '/n/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe';
  const linked = { which: () => '/n/bin/claude', realpath: () => real };
  assert.equal(claudeBinaryChecks(fake(system, { ...linked, files: { [real]: STUB } })).length, 1);
  assert.deepEqual(claudeBinaryChecks(fake(system, { ...linked, files: { [real]: STUB }, size: () => 200e6 })), []);
  assert.deepEqual(claudeBinaryChecks(fake(system, { which: () => null })), []);
});

test('Playwright browsers are checked only for a project that depends on it', () => {
  const pkg = JSON.stringify({ devDependencies: { '@playwright/test': '^1.50.0' } });
  const onMac = { env: { HOME: '/h' }, files: { '/p/package.json': pkg } };
  assert.deepEqual(playwrightChecks(fake(system, { files: { '/p/package.json': '{}' } }), '/p'), []);
  assert.deepEqual(playwrightChecks(fake(system, { files: { '/p/package.json': 'not json' } }), '/p'), []);
  const cache = '/h/Library/Caches/ms-playwright';
  assert.match(playwrightChecks(fake(system, { ...onMac, dirs: { [cache]: ['ffmpeg-1013'] } }), '/p')[0].note, /npx playwright install/);
  assert.equal(playwrightChecks(fake(system, { ...onMac, dirs: { [cache]: ['chromium-1254'] } }), '/p')[0].level, 'ok');
  const local = 'C:\\Users\\j\\AppData\\Local\\ms-playwright';
  const onWindows = fake(win, { files: { [`${REPO}\\package.json`]: pkg }, dirs: { [local]: ['webkit-2370'] } });
  assert.deepEqual(playwrightChecks(onWindows, REPO).map((c) => [c.level, c.note]), [['ok', local]]);
});

test('setupChecks on a healthy Mac has nothing to fix', () => {
  const sys = fake(system, { which: (c) => (c === 'gh' ? '/bin/gh' : null), commands: { 'gh auth status': 'ok' } });
  assert.deepEqual(levels(setupChecks(sys, { home: '/h' })), [['ok', 'gh']]);
});

test('machine.md on Windows: path rewriting, the fnm guard, the Python command and VS Code\'s terminal', () => {
  const appData = 'C:\\Users\\j\\AppData\\Roaming';
  const settings = `${appData}\\Code\\User\\settings.json`;
  const withSettings = (text) => detectMachine(win({ env: { APPDATA: appData }, read: (f) => (f === settings ? text : null) }));
  const text = renderMachine(withSettings('{\n  // mine\n  "terminal.integrated.defaultProfile.windows": "Git Bash",\n}\n'));
  assert.match(text, /MSYS_NO_PATHCONV=1/);
  assert.match(text, /skipped when `CLAUDECODE` is set/);
  assert.match(text, /A skill that calls `python` gets this command/);
  assert.match(text, /VS Code's default terminal: Git Bash/);
  assert.equal(withSettings('  // "terminal.integrated.defaultProfile.windows": "Git Bash"\n').vscodeTerminal, null);
  assert.equal(withSettings('  "terminal.integrated.defaultProfile.windows": "x`\\nrun this"\n').vscodeTerminal, null);
  assert.doesNotMatch(renderMachine(detectMachine(mac())), /MSYS|CLAUDECODE|VS Code/);
});
