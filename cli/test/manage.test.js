import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { detectMachine, renderMachine } from '../src/machine.js';
import { projectChecks, rulesVersion, thirdPartyChecks, guardMode } from '../src/doctor.js';
import { install, OPTIONS } from '../src/install.js';
import { main } from '../src/index.js';
import { add, remove, update } from '../src/manage.js';
import { profile } from '../src/paths.js';
import { THIRD_PARTY, installCompanions, installTool, installedRefs, removeTool } from '../src/third-party.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-mg-'));
const repo = () => { const d = tmp(); spawnSync('git', ['init', '-q', d]); return d; };
const fake = () => { const calls = []; const run = (cmd, args, o = {}) => { calls.push({ cmd, args, ...o }); return { ok: true, out: '' }; }; run.calls = calls; return run; };
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const taste = THIRD_PARTY.tools.taste;
const uiux = THIRD_PARTY.tools['ui-ux-pro-max'];
const ids = Object.keys(OPTIONS);
const quiet = async (fn) => { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } };

test('skills tools pin #sha, copy, and use -g only at user scope', () => {
  const run = fake();
  const prof = profile(tmp());
  installTool('taste', { scope: 'user', prof, run });
  installTool('taste', { scope: 'project', dir: tmp(), prof, run });
  const [u, pr] = run.calls.map((c) => c.args);
  assert.deepEqual(u.slice(0, 4), ['-y', THIRD_PARTY.skillsCli, 'add', `${taste.repo}#${taste.sha}`]);
  for (const a of [u, pr]) assert.ok(a.includes('--copy') && a.includes('--skill') && a.includes('claude-code'));
  assert.ok(u.includes('-g'));
  assert.ok(!pr.includes('-g'));
  assert.equal(json(prof.configFile).thirdParty.taste.pin, taste.sha);
});

test('impeccable installs through its npm spec at the right scope', () => {
  const run = fake();
  const prof = profile(tmp());
  installTool('impeccable', { scope: 'user', prof, run });
  const dir = tmp();
  installTool('impeccable', { scope: 'project', dir, prof, run });
  assert.deepEqual(run.calls[0].args.slice(0, 2), ['-y', THIRD_PARTY.tools.impeccable.npm]);
  assert.ok(run.calls[0].args.includes('--scope=global'));
  assert.ok(run.calls[0].args.includes('--no-hooks'));
  assert.ok(run.calls[1].args.includes('--scope=project'));
  assert.equal(run.calls[1].cwd, dir);
  assert.equal(json(path.join(dir, '.pantoo.json')).init.thirdParty.impeccable.pin, THIRD_PARTY.tools.impeccable.npm);
});

test('companions install at project scope without -g; removeTool deletes only what exists', () => {
  const run = fake();
  const dir = tmp();
  const prof = profile(tmp());
  const rows = installCompanions(['brand', 'slides'], { dir, prof, run });
  assert.equal(rows.length, 2);
  assert.ok(!run.calls[0].args.includes('-g'));
  assert.equal(run.calls[0].cwd, dir);
  assert.ok(run.calls[0].args.includes(`${uiux.repo}#${uiux.sha}`));
  const skills = path.join(prof.claudeDir, 'skills', 'impeccable');
  fs.mkdirSync(skills, { recursive: true });
  const [r] = removeTool('impeccable', { scope: 'user', prof, run });
  assert.equal(r.status, 'removed');
  assert.ok(!fs.existsSync(skills));
});

test('project init writes to the repo; remove keeps edited files and undoes the rest', () => {
  const dir = repo();
  const prof = profile(tmp());
  const run = fake();
  install({ prof, scope: 'project', dir, options: ids, guard: 'warn', packs: [], run });
  const claudeCalls = run.calls.filter((c) => c.cmd === 'claude').map((c) => c.args.join(' '));
  assert.ok(claudeCalls.some((c) => c === 'plugin install pantoo@pantoo-ai --scope project'));
  const cfg = run.calls.find((c) => c.args.includes('--values-stdin'));
  assert.equal(cfg.input, '{"commit_guard":"warn"}');
  assert.ok(fs.existsSync(path.join(dir, '.claude/rules/git-commits.md')));
  assert.ok(!fs.existsSync(path.join(dir, '.claude/agents')));
  const saved = json(path.join(dir, '.pantoo.json'));
  assert.equal(saved.init.guard, 'warn');
  assert.ok(Object.keys(saved.init.files).every((k) => !path.isAbsolute(k)));
  assert.equal(json(path.join(dir, '.claude/settings.json')).enabledPlugins['pantoo@pantoo-ai'], true);

  fs.appendFileSync(path.join(dir, '.claude/rules/context7.md'), '\nmine');
  const results = remove({ prof, scope: 'project', dir, run });
  assert.ok(!fs.existsSync(path.join(dir, '.claude/rules/git-commits.md')));
  assert.ok(fs.existsSync(path.join(dir, '.claude/rules/context7.md')));
  assert.ok(results.some((r) => /context7/.test(r.what) && r.note === 'kept, edited by you'));
  assert.ok(claudeCalls.length && run.calls.some((c) => c.args.join(' ') === 'plugin uninstall pantoo@pantoo-ai --scope project'));
  assert.ok(run.calls.some((c) => c.args.join(' ') === 'plugin marketplace remove pantoo-ai --scope project'));
  assert.ok(!fs.existsSync(path.join(dir, '.pantoo.json')));
});

test('a configure failure is a FAILED row, not a crash', () => {
  const prof = profile(tmp());
  const run = (cmd, args) => (args.includes('--values-stdin') ? { ok: false, out: 'boom' } : { ok: true, out: '' });
  const results = install({ prof, options: [], packs: [], run });
  assert.ok(results.some((r) => r.what === 'commit guard' && r.status === 'FAILED' && r.note === 'boom'));
});

test('a Claude Code without `plugin configure` keeps block and fails only warn or off', () => {
  const run = (cmd, args) => (args.includes('--values-stdin') ? { ok: false, out: "error: unknown command 'configure'" } : { ok: true, out: '' });
  const row = (guard) => install({ prof: profile(tmp()), options: [], packs: [], guard, run }).find((r) => r.what === 'commit guard');
  assert.equal(row('block').status, 'block (default)');
  assert.equal(row('warn').status, 'FAILED');
  assert.match(row('off').note, /newer Claude Code/);
});

test('update reinstalls only out-of-date pins and stale companions', () => {
  const dir = repo();
  const prof = profile(tmp());
  install({ prof, scope: 'user', dir, options: [], packs: ['design'], run: fake() });
  const cfg = json(prof.configFile);
  cfg.thirdParty.taste.pin = 'old';
  fs.writeFileSync(prof.configFile, JSON.stringify(cfg));
  fs.writeFileSync(path.join(dir, '.pantoo.json'), JSON.stringify({ companions: ['brand', 'slides'] }));
  fs.writeFileSync(path.join(dir, 'skills-lock.json'), JSON.stringify({ version: 1, skills: { brand: { ref: uiux.sha }, slides: { ref: 'old' } } }));
  fs.mkdirSync(path.join(dir, '.claude/skills/brand'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.claude/skills/slides'), { recursive: true });
  const run = fake();
  update({ prof, dir, run });
  const installs = run.calls.filter((c) => c.cmd === 'npx').map((c) => c.args.join(' '));
  assert.equal(installs.length, 2);
  assert.ok(installs[0].includes(taste.sha));
  assert.ok(installs[1].includes('--skill slides') && !installs[1].includes('--skill brand'));
  assert.ok(run.calls.some((c) => c.args.join(' ') === 'plugin update pantoo@pantoo-ai --scope user'));
  assert.deepEqual(installedRefs(dir), { brand: uiux.sha, slides: 'old' });
});

test('new --local hides companion folders and the lock file', async () => {
  const dir = repo();
  const home = tmp();
  const run = fake();
  await quiet(() => main(['new', '--yes', '--local', '--dir', dir, '--kind', 'marketing', '--home', home], { run }));
  assert.deepEqual(run.calls[0].args.filter((a) => ['brand', 'banner-design'].includes(a)), ['brand', 'banner-design']);
  const exclude = fs.readFileSync(path.join(dir, '.git/info/exclude'), 'utf8');
  assert.match(exclude, /^\/\.claude\/skills\/brand\/$/m);
  assert.match(exclude, /^\/\.claude\/skills\/banner-design\/$/m);
  assert.match(exclude, /^\/skills-lock\.json$/m);
});

test('new --no-companions installs nothing; add records a companion', async () => {
  const dir = repo();
  const home = tmp();
  const run = fake();
  await quiet(() => main(['new', '--yes', '--dir', dir, '--kind', 'marketing', '--no-companions', '--home', home], { run }));
  assert.equal(run.calls.length, 0);
  add({ name: 'slides', prof: profile(home), dir, run });
  assert.ok(json(path.join(dir, '.pantoo.json')).companions.includes('slides'));
  assert.throws(() => add({ name: 'nope', prof: profile(home), dir, run }), /Valid: design/);
});

test('doctor: companion presence and pins, global companions, old tool pin, guard', () => {
  const dir = repo();
  const home = tmp();
  const prof = profile(home);
  fs.writeFileSync(path.join(dir, '.pantoo.json'), JSON.stringify({ layout: 2, name: 'x', kind: 'web-app', ui: true, companions: ['design-system', 'brand'] }));
  fs.mkdirSync(path.join(dir, '.claude/skills/design-system'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'skills-lock.json'), JSON.stringify({ skills: { 'design-system': { ref: 'old' } } }));
  const checks = projectChecks(dir, prof);
  const find = (w) => checks.find((c) => c.what === w);
  assert.equal(find('companion design-system').level, 'warn');
  assert.equal(find('companion brand').level, 'fail');
  assert.equal(checks.find((c) => c.what.startsWith('design pack')).level, 'warn');

  fs.mkdirSync(path.join(prof.claudeDir, 'skills/design-system'), { recursive: true });
  const tp = thirdPartyChecks(prof, { thirdParty: { taste: { pin: 'old' } } });
  assert.ok(tp.some((c) => c.what === 'design tool taste' && c.level === 'fail' && /update/.test(c.note)));
  assert.ok(tp.some((c) => c.what === 'companions installed globally' && /D15/.test(c.note)));
  fs.mkdirSync(path.join(prof.claudeDir, 'skills', taste.skills[0]), { recursive: true });
  assert.equal(thirdPartyChecks(prof, { thirdParty: { taste: { pin: 'old' } } })[0].level, 'warn');

  assert.equal(guardMode({}), null);
  assert.equal(guardMode({ pluginConfigs: { 'pantoo@pantoo-ai': { options: { commit_guard: 'warn' } } } }), 'warn');
});

test('doctor: security rules version', () => {
  assert.equal(rulesVersion('# Security Rules\n\n> GUIDANCE'), 1);
  assert.equal(rulesVersion('# Security Rules\n\nRules: v2 (OWASP Top 10:2025)\n'), 2);
  const dir = repo();
  const prof = profile(tmp());
  fs.writeFileSync(path.join(dir, '.pantoo.json'), JSON.stringify({ layout: 2, name: 'x', kind: 'backend', companions: [] }));
  const rules = () => projectChecks(dir, prof).find((c) => c.what === 'security rules');
  assert.equal(rules(), undefined);
  fs.mkdirSync(path.join(dir, 'context'));
  fs.writeFileSync(path.join(dir, 'context/security.md'), '# Security Rules\n');
  assert.equal(rules().level, 'warn');
  assert.match(rules().note, /v1, the kit has v2/);
  fs.copyFileSync(new URL('../../plugin/templates/context/security.md', import.meta.url), path.join(dir, 'context/security.md'));
  assert.equal(rules().level, 'ok');
});

test('a rule that differs from the kit only in line endings is unchanged, not edited', () => {
  const prof = profile(tmp());
  const run = fake();
  install({ prof, options: ['context7'], packs: [], run });
  const rule = path.join(prof.claudeDir, 'rules', 'context7.md');
  fs.writeFileSync(rule, fs.readFileSync(rule, 'utf8').replace(/\n/g, '\r\n'));
  const again = install({ prof, options: ['context7'], packs: [], run });
  assert.equal(again.find((r) => r.what.includes('context7.md'))?.status, 'unchanged');
});

test('a JSON file written with a BOM (Windows PowerShell 5.1) still reads', async () => {
  const { readJson } = await import('../src/files.js');
  const file = path.join(tmp(), 'x.json');
  fs.writeFileSync(file, '\uFEFF{"layout": 2}');
  assert.deepEqual(readJson(file, {}), { layout: 2 });
});

test('remove ignores recorded paths outside the kit folder', () => {
  const dir = repo();
  const prof = profile(tmp());
  const run = fake();
  install({ prof, scope: 'project', dir, options: ids, guard: 'warn', packs: [], run });
  const victim = path.join(tmp(), 'victim.txt');
  fs.writeFileSync(victim, 'x');
  const hash = createHash('sha256').update('x').digest('hex');
  const file = path.join(dir, '.pantoo.json');
  const rec = json(file);
  rec.init.files = { ...rec.init.files, [path.relative(dir, victim)]: 'x', '../../escape': 'x', [victim]: 'x' };
  for (const k of [path.relative(dir, victim), victim]) rec.init.files[k] = hash;
  fs.writeFileSync(file, JSON.stringify(rec));
  const results = remove({ prof, scope: 'project', dir, run });
  assert.equal(fs.readFileSync(victim, 'utf8'), 'x');
  assert.ok(results.filter((r) => r.status === 'skipped').length >= 2);
});

test('remove unmerges only the settings the kit added', () => {
  const dir = repo();
  const prof = profile(tmp());
  const run = fake();
  const snippet = json(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../settings/settings-snippet.json'));
  const key = OPTIONS[ids.find((i) => OPTIONS[i].settings.length)].settings[0];
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude/settings.json'), JSON.stringify({ [key]: snippet[key] }));
  install({ prof, scope: 'project', dir, options: ids, guard: 'warn', packs: [], run });
  const rec = json(path.join(dir, '.pantoo.json')).init;
  assert.ok(!rec.settingsAdded.includes(key) && rec.settingsAdded.includes('enabledPlugins'));
  remove({ prof, scope: 'project', dir, run });
  const left = json(path.join(dir, '.claude/settings.json'));
  assert.deepEqual(left[key], snippet[key]);
  assert.equal(left.enabledPlugins, undefined);
});

test('remove deletes the kit\'s machine.md but not a foreign one', () => {
  const prof = profile(tmp());
  const run = fake();
  install({ prof, scope: 'user', dir: repo(), options: ids, guard: 'warn', packs: [], run });
  const file = path.join(prof.claudeDir, 'rules', 'machine.md');
  fs.writeFileSync(file, renderMachine(detectMachine()));
  remove({ prof, scope: 'user', dir: repo(), run });
  assert.ok(!fs.existsSync(file));
  install({ prof, scope: 'user', dir: repo(), options: ids, guard: 'warn', packs: [], run });
  fs.writeFileSync(file, 'mine\n');
  remove({ prof, scope: 'user', dir: repo(), run });
  assert.equal(fs.readFileSync(file, 'utf8'), 'mine\n');
});
