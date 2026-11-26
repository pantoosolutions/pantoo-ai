import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { detectMachine, renderMachine } from '../src/machine.js';
import { projectChecks, rulesVersion, thirdPartyChecks, toolChecks, guardMode } from '../src/doctor.js';
import { install, OPTIONS } from '../src/install.js';
import { main } from '../src/index.js';
import { add, remove, update } from '../src/manage.js';
import { profile } from '../src/paths.js';
import { THIRD_PARTY, folderHash, installCompanions, installTool, installedRefs, removeTool, setHolds, skillState } from '../src/third-party.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-mg-'));
const repo = () => { const d = tmp(); spawnSync('git', ['init', '-q', d]); return d; };
// The pinned bundle is 20 MB, so tests expect this stand-in's hash and `fake` "downloads" it.
const impeccable = THIRD_PARTY.tools.impeccable;
const PINNED_BUNDLE = { ...impeccable.bundle };
const BUNDLE = 'stand-in bundle';
impeccable.bundle.sha256 = createHash('sha256').update(BUNDLE).digest('hex');
const fake = ({ bundle = BUNDLE } = {}) => {
  const calls = [];
  const run = (cmd, args, o = {}) => {
    calls.push({ cmd, args, ...o });
    if (cmd === 'curl') fs.writeFileSync(args[args.indexOf('-o') + 1], bundle);
    return { ok: true, out: '' };
  };
  run.calls = calls;
  return run;
};
// A skill folder with these files. The real pins are too big to ship with the tests, so `pinned`
// makes a stand-in folder the kit's pin (or an earlier one) for one test.
const skill = (root, name, files) => {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, name, rel), text);
  }
  return path.join(root, name);
};
const pinned = (t, entry, name, files) => {
  const was = entry.hashes[name];
  entry.hashes[name] = folderHash(skill(tmp(), name, files));
  t.after(() => { entry.hashes[name] = was; });
};
const front = (version) => ({ 'SKILL.md': `---\nname: impeccable\nversion: ${version}\n---\nbody\n` });
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const taste = THIRD_PARTY.tools.taste;
const uiux = THIRD_PARTY.tools['ui-ux-pro-max'];
const emil = THIRD_PARTY.tools.emil;
// Every skill of a tool on disk with the same stand-in text: not the pin, but not older either.
const lay = (root, tool, text = 'x') => { for (const n of tool.skills) skill(root, n, { 'SKILL.md': text }); };
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
  const [user, project] = run.calls.filter((c) => c.cmd === 'npx');
  assert.deepEqual(user.args.slice(0, 2), ['-y', impeccable.npm]);
  assert.ok(user.args.includes('--scope=global'));
  assert.ok(user.args.includes('--no-hooks'));
  assert.ok(project.args.includes('--scope=project'));
  assert.equal(project.cwd, dir);
  assert.equal(json(path.join(dir, '.pantoo.json')).init.thirdParty.impeccable.pin, THIRD_PARTY.tools.impeccable.npm);
});

test('impeccable pins its skill bundle by url and sha256', () => {
  const version = impeccable.npm.split('@')[1];
  assert.equal(impeccable.tag, `skill-v${version}`);
  assert.equal(PINNED_BUNDLE.url, `https://github.com/${impeccable.repo}/releases/download/${impeccable.tag}/universal.zip`);
  assert.match(PINNED_BUNDLE.sha256, /^[0-9a-f]{64}$/);
});

test('impeccable hands the installer the checked bundle, then deletes it', () => {
  const calls = fake();
  let seen;
  const run = (cmd, args, o) => {
    if (cmd === 'npx') seen = fs.readFileSync(o.env.IMPECCABLE_BUNDLE_PATH, 'utf8');
    return calls(cmd, args, o);
  };
  const [r] = installTool('impeccable', { scope: 'user', prof: profile(tmp()), run });
  assert.equal(r.status, 'installed');
  assert.deepEqual(calls.calls.map((c) => c.cmd), ['curl', 'npx']);
  const [curl, npx] = calls.calls;
  assert.equal(curl.args.at(-1), PINNED_BUNDLE.url);
  assert.equal(curl.args[curl.args.indexOf('--proto-redir') + 1], '=https');
  assert.equal(seen, BUNDLE);
  assert.ok(!fs.existsSync(npx.env.IMPECCABLE_BUNDLE_PATH));
});

test('impeccable is not installed or recorded when the bundle is wrong or the download fails', () => {
  const failing = () => { const run = (cmd, args) => { run.calls.push({ cmd, args }); return { ok: false, out: 'curl: (22) 404' }; }; run.calls = []; return run; };
  for (const [run, note] of [[fake({ bundle: 'tampered' }), /sha256 is .* not installed/], [failing(), /download failed: curl: \(22\) 404/]]) {
    const prof = profile(tmp());
    const [r] = installTool('impeccable', { scope: 'user', prof, run });
    assert.equal(r.status, 'FAILED');
    assert.match(r.note, note);
    assert.deepEqual(run.calls.map((c) => c.cmd), ['curl']);
    assert.ok(!fs.existsSync(prof.configFile));
  }
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
  // The other tools are on disk, so only taste's old saved pin sends it back to the installer.
  skill(path.join(prof.claudeDir, 'skills'), 'impeccable', front(impeccable.npm.split('@')[1]));
  for (const t of [taste, uiux, emil]) lay(path.join(prof.claudeDir, 'skills'), t);
  const run = fake();
  update({ prof, dir, run });
  const installs = run.calls.filter((c) => c.cmd === 'npx').map((c) => c.args.join(' '));
  assert.equal(installs.length, 2);
  assert.ok(installs[0].includes(taste.sha));
  assert.ok(installs[1].includes('--skill slides') && !installs[1].includes('--skill brand'));
  assert.ok(run.calls.some((c) => c.args.join(' ') === 'plugin update pantoo@pantoo-ai --scope user'));
  assert.deepEqual(installedRefs(dir), { brand: uiux.sha, slides: 'old' });
});

test('update reinstalls a tool whose files are older than the saved pin says, or are gone', () => {
  const prof = profile(tmp());
  const dir = repo();
  install({ prof, scope: 'user', dir, options: [], packs: ['design'], run: fake() });
  const root = path.join(prof.claudeDir, 'skills');
  skill(root, 'impeccable', front('4.8.0'));
  skill(root, taste.skills[0], { 'SKILL.md': 'newer or edited' });
  lay(root, emil);
  const run = fake();
  update({ prof, dir, run });
  const installs = run.calls.filter((c) => c.cmd === 'npx').map((c) => c.args.join(' '));
  assert.equal(installs.length, 2);
  assert.ok(installs[0].includes(impeccable.npm));
  assert.ok(installs[1].includes(uiux.sha));
});

test('folderHash ignores line endings in text, and files made by running the skill', () => {
  const files = { 'SKILL.md': 'a\nb\n', 'scripts/run.py': 'print(1)\n' };
  const base = folderHash(skill(tmp(), 's', files));
  const crlf = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.replace(/\n/g, '\r\n')]));
  assert.equal(folderHash(skill(tmp(), 's', { ...crlf, 'scripts/__pycache__/run.cpython-315.pyc': 'x', '.DS_Store': 'x' })), base);
  assert.notEqual(folderHash(skill(tmp(), 's', { ...files, 'extra.md': '' })), base);
  assert.notEqual(folderHash(skill(tmp(), 's', { ...files, 'SKILL.md': 'a\nc\n' })), base);
  const bin = (text) => folderHash(skill(tmp(), 's', { 'a.png': text }));
  assert.notEqual(bin('\0\r\n'), bin('\0\n'));
});

test('every skills tool and companion has a hash for each pin the kit knows', () => {
  for (const tool of [taste, uiux, emil]) {
    for (const entry of [tool, ...(tool.previous ?? [])]) {
      assert.deepEqual(Object.keys(entry.hashes).filter((n) => tool.skills.includes(n) || tool.companions?.includes(n)).sort(),
        [...tool.skills, ...(tool.companions ?? [])].sort(), entry.tag);
      for (const h of Object.values(entry.hashes)) assert.match(h, /^[0-9a-f]{64}$/);
    }
  }
});

test('a tool with several skills installs them all at the pin, globally at user scope', () => {
  const run = fake();
  installTool('emil', { scope: 'user', prof: profile(tmp()), run });
  const args = run.calls[0].args.join(' ');
  assert.ok(args.includes(`${emil.repo}#${emil.sha}`) && args.includes(' -g'));
  assert.deepEqual(run.calls[0].args.filter((a, i, all) => all[i - 1] === '--skill'), emil.skills);
});

test('doctor, update and holds read every skill of a tool, not just the first', (t) => {
  for (const n of emil.skills) pinned(t, emil, n, { 'SKILL.md': `kit ${n}\n` });
  const earlier = { tag: 'main@0000000', sha: '0'.repeat(40), hashes: {} };
  for (const n of emil.skills) earlier.hashes[n] = folderHash(skill(tmp(), n, { 'SKILL.md': `earlier ${n}\n` }));
  emil.previous = [earlier];
  t.after(() => { delete emil.previous; });
  const atPin = (root) => { for (const n of emil.skills) skill(root, n, { 'SKILL.md': `kit ${n}\n` }); return root; };

  // doctor: all at the pin is ok; one edited by hand is newer, and the row names it.
  const root = atPin(tmp());
  assert.deepEqual(toolChecks(root, { emil: { pin: emil.sha } })[0].level, 'ok');
  const last = emil.skills.at(-1);
  skill(root, last, { 'SKILL.md': 'edited by hand\n' });
  const edited = toolChecks(root, { emil: { pin: emil.sha } })[0];
  assert.equal(edited.level, 'warn');
  assert.match(edited.note, new RegExp(`^${last}: newer`));

  // update: one skill at the earlier pin sends the tool back to the installer; all at the pin doesn't.
  const prof = profile(tmp());
  const dir = repo();
  install({ prof, scope: 'user', dir, options: [], packs: ['design'], run: fake() });
  const skills = path.join(prof.claudeDir, 'skills');
  skill(skills, 'impeccable', front(impeccable.npm.split('@')[1]));
  for (const x of [taste, uiux]) lay(skills, x);
  atPin(skills);
  const emilInstalls = () => { const run = fake(); update({ prof, dir, run }); return run.calls.filter((c) => c.cmd === 'npx' && c.args.includes(`${emil.repo}#${emil.sha}`)).length; };
  assert.equal(emilInstalls(), 0);
  skill(skills, last, { 'SKILL.md': `earlier ${last}\n` });
  assert.equal(emilInstalls(), 1);

  // holds: refused while the skills are at different pins; at one pin, the hold survives update.
  assert.throws(() => setHolds({ hold: ['emil'] }, { dir, prof }), /no version this kit knows/);
  for (const n of emil.skills) skill(skills, n, { 'SKILL.md': `earlier ${n}\n` });
  setHolds({ hold: ['emil'] }, { dir, prof });
  assert.deepEqual(json(prof.configFile).holds, { emil: earlier.sha });
  assert.equal(emilInstalls(), 0);
  assert.equal(toolChecks(skills, { emil: { pin: emil.sha } }, { emil: earlier.sha })[0].note, `held at ${earlier.tag} (kit pins ${emil.tag})`);
});

test('doctor reads the installed skill: CRLF copy ok, hand update newer, earlier pin older, held', (t) => {
  const name = taste.skills[0];
  pinned(t, taste, name, { 'SKILL.md': 'kit\n' });
  pinned(t, taste.previous[0], name, { 'SKILL.md': 'earlier\n' });
  const was = taste.previous[0];
  const row = (text, holds) => {
    const root = tmp();
    skill(root, name, { 'SKILL.md': text });
    // The saved pin says the kit's, whatever is on disk.
    return toolChecks(root, { taste: { pin: taste.sha } }, holds)[0];
  };
  assert.deepEqual([row('kit\r\n').level, row('kit\r\n').note], ['ok', '']);
  assert.equal(row('updated by hand\n').level, 'warn');
  assert.match(row('updated by hand\n').note, new RegExp(`newer.*${taste.tag}`));
  assert.equal(row('earlier\n').level, 'warn');
  assert.match(row('earlier\n').note, new RegExp(`older: ${was.tag}.*update`));
  const held = row('earlier\n', { taste: was.sha });
  assert.deepEqual([held.level, held.note], ['ok', `held at ${was.tag} (kit pins ${taste.tag})`]);
  const broken = row('kit\n', { taste: was.sha });
  assert.equal(broken.level, 'warn');
  assert.match(broken.note, new RegExp(`held at ${was.tag}, but the installed skill is ${taste.tag}`));
});

test('doctor compares impeccable by the version in SKILL.md', () => {
  const [, major, minor] = impeccable.npm.match(/@(\d+)\.(\d+)/).map(Number);
  const state = (version, hold) => {
    const root = tmp();
    skill(root, 'impeccable', front(version));
    return skillState('impeccable', { root, hold }).state;
  };
  assert.equal(state(impeccable.npm.split('@')[1]), 'ok');
  assert.equal(state(`${major}.${minor - 1}.9`), 'older');
  assert.equal(state(`${major}.${minor + 1}.0`), 'newer');
  assert.equal(state('4.8.0', 'impeccable@4.8.0'), 'held');
  assert.equal(state('4.9.0', 'impeccable@4.8.0'), 'changed');
});

test('doctor checks companions by their files, and a hold on ui-ux-pro-max covers them', (t) => {
  pinned(t, uiux, 'brand', { 'SKILL.md': 'kit\n' });
  pinned(t, uiux.previous[0], 'brand', { 'SKILL.md': 'earlier\n' });
  const dir = tmp();
  const prof = profile(tmp());
  fs.writeFileSync(path.join(dir, '.pantoo.json'), JSON.stringify({ layout: 2, name: 'x', kind: 'web-app', companions: ['brand', '../../..'] }));
  // No lock file at all: the folder is what counts.
  const level = (text, holds) => {
    skill(path.join(dir, '.claude/skills'), 'brand', { 'SKILL.md': text });
    fs.mkdirSync(path.dirname(prof.configFile), { recursive: true });
    fs.writeFileSync(prof.configFile, JSON.stringify({ holds }));
    return projectChecks(dir, prof).find((c) => c.what === 'companion brand');
  };
  assert.equal(level('kit\n').level, 'ok');
  assert.match(level('earlier\n').note, /^older/);
  assert.ok(level('earlier\n', { 'ui-ux-pro-max': uiux.previous[0].sha }).note.startsWith(`held at ${uiux.previous[0].tag}`));
  assert.equal(level('kit\n', { 'ui-ux-pro-max': uiux.previous[0].sha }).level, 'ok');
  assert.match(projectChecks(dir, prof).find((c) => c.what === 'companion ../../..').note, /not a companion/);
});

test('lock v1 (`ref`) and lock v2 (`commit`) give the same refs', () => {
  const dir = tmp();
  const refs = (version, entry) => {
    fs.writeFileSync(path.join(dir, 'skills-lock.json'), JSON.stringify({ version, skills: { brand: entry } }));
    return installedRefs(dir);
  };
  const pinned = { brand: uiux.sha };
  assert.deepEqual(refs(1, { ref: uiux.sha }), pinned);
  assert.deepEqual(refs(2, { ref: uiux.sha, commit: uiux.sha, installMode: 'copy' }), pinned);
  assert.deepEqual(refs(2, { commit: uiux.sha, installMode: 'copy' }), pinned);
  assert.deepEqual(refs(2, { ref: 'main', commit: uiux.sha }), pinned);
});

test('update leaves companions that a lock v2 shows at the pin', () => {
  const dir = repo();
  const prof = profile(tmp());
  install({ prof, scope: 'user', dir, options: [], packs: [], run: fake() });
  fs.writeFileSync(path.join(dir, '.pantoo.json'), JSON.stringify({ companions: ['brand'] }));
  fs.writeFileSync(path.join(dir, 'skills-lock.json'), JSON.stringify({ version: 2, skills: { brand: { commit: uiux.sha, installMode: 'copy' } } }));
  fs.mkdirSync(path.join(dir, '.claude/skills/brand'), { recursive: true });
  const run = fake();
  const results = update({ prof, dir, run });
  assert.ok(!run.calls.some((c) => c.cmd === 'npx'));
  assert.ok(results.some((r) => r.what === 'companions' && r.status === 'up to date'));
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

test('a hold is saved from what is installed, survives update, and release lets it move', async (t) => {
  const name = taste.skills[0];
  const was = taste.previous[0];
  pinned(t, was, name, { 'SKILL.md': 'earlier\n' });
  const home = tmp();
  const dir = repo();
  const prof = profile(home);
  install({ prof, scope: 'user', dir, options: [], packs: ['design'], run: fake() });
  const root = path.join(prof.claudeDir, 'skills');
  skill(root, 'impeccable', front(impeccable.npm.split('@')[1]));
  skill(root, name, { 'SKILL.md': 'earlier\n' });
  skill(root, uiux.skills[0], { 'SKILL.md': 'x' });
  const run = fake();
  const go = (...flags) => quiet(() => main(['update', '--no-self-update', '--home', home, '--dir', dir, ...flags], { run }));
  const tasteInstalls = () => run.calls.filter((c) => c.cmd === 'npx' && c.args.join(' ').includes(taste.repo)).length;

  await go('--hold', 'taste');
  await go();
  assert.deepEqual(json(prof.configFile).holds, { taste: was.sha });
  assert.equal(tasteInstalls(), 0);
  assert.ok(update({ prof, dir, run }).some((r) => r.what === 'design tool taste' && r.status === 'held' && r.note.includes(was.tag)));
  // `init` and `add design` leave it alone too.
  install({ prof, scope: 'user', dir, options: [], packs: ['design'], run });
  add({ name: 'design', prof, dir, run });
  assert.equal(tasteInstalls(), 0);
  assert.deepEqual(json(prof.configFile).holds, { taste: was.sha });

  fs.rmSync(path.join(root, name), { recursive: true });
  assert.match(toolChecks(root, { taste: {} }, { taste: was.sha })[0].note, /update --release taste/);
  await go('--release', 'taste');
  assert.equal(json(prof.configFile).holds, undefined);
  assert.equal(tasteInstalls(), 1);
});

test('holding impeccable records the version in SKILL.md, not the saved pin', () => {
  const prof = profile(tmp());
  const dir = tmp();
  install({ prof, scope: 'user', dir, options: [], packs: [], run: fake() });
  skill(path.join(prof.claudeDir, 'skills'), 'impeccable', front('4.8.0'));
  setHolds({ hold: ['impeccable'] }, { dir, prof });
  assert.deepEqual(json(prof.configFile).holds, { impeccable: 'impeccable@4.8.0' });
});

test('a hold on ui-ux-pro-max stops companion installs', () => {
  const prof = profile(tmp());
  const dir = repo();
  install({ prof, scope: 'user', dir, options: [], packs: [], run: fake() });
  fs.writeFileSync(prof.configFile, JSON.stringify({ ...json(prof.configFile), holds: { 'ui-ux-pro-max': uiux.previous[0].sha } }));
  fs.writeFileSync(path.join(dir, '.pantoo.json'), JSON.stringify({ companions: ['brand'] }));
  const run = fake();
  const results = update({ prof, dir, run });
  assert.ok(!run.calls.some((c) => c.cmd === 'npx'));
  assert.ok(results.some((r) => r.what === 'companions' && r.status === 'held'));
});

test('a hold that can\'t be honoured is refused, and nothing is written', () => {
  const prof = profile(tmp());
  const dir = tmp();
  const ctx = { dir, prof };
  assert.throws(() => setHolds({ hold: ['taste'] }, ctx), /run `npx pantoo-ai init` first/);
  assert.ok(!fs.existsSync(prof.configFile));
  install({ prof, scope: 'user', dir, options: [], packs: [], run: fake() });
  const before = fs.readFileSync(prof.configFile, 'utf8');
  assert.throws(() => setHolds({ hold: ['nope'] }, ctx), /Unknown tool "nope". Valid: impeccable, taste, ui-ux-pro-max, emil/);
  assert.throws(() => setHolds({ release: ['constructor'] }, ctx), /Unknown tool/);
  assert.throws(() => setHolds({ hold: ['taste'], release: ['taste'] }, ctx), /at once/);
  assert.throws(() => setHolds({ hold: ['taste'] }, ctx), /isn't installed/);
  skill(path.join(prof.claudeDir, 'skills'), 'impeccable', front('4.8.0'));
  skill(path.join(prof.claudeDir, 'skills'), taste.skills[0], { 'SKILL.md': 'edited by hand' });
  assert.throws(() => setHolds({ hold: ['impeccable', 'taste'] }, ctx), /no version this kit knows/);
  assert.equal(fs.readFileSync(prof.configFile, 'utf8'), before);
});
