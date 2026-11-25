import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { doctor, machineChecks, tasteChecks } from '../src/doctor.js';
import { applyKit, install, target } from '../src/install.js';
import { MACHINE_RULE, detectMachine, findBrowser, renderMachine, writeMachineRule } from '../src/machine.js';
import { profile } from '../src/paths.js';
import { winQuote } from '../src/spawn.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-mc-'));
const system = (over = {}) => ({
  platform: 'darwin', arch: 'x64', env: {}, nodeVersion: '22.1.0', nodePath: '/usr/local/bin/node',
  exists: () => false, run: () => null, which: () => null, osVersion: () => '26.6', ...over,
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
