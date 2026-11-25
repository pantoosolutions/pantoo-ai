import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { lineEndingChecks, projectChecks } from '../src/doctor.js';
import { profile } from '../src/paths.js';
import { MANIFEST, scaffold, templatesDir } from '../src/scaffold.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-new-'));
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const base = { name: 'demo', kind: 'web-app', ui: true, existing: false, multiSurface: false, local: false, share: true };

test('new project: spine, UI files, settings, gitignore', () => {
  const dir = tmp();
  scaffold(dir, base);
  for (const rel of ['AGENTS.md', 'CLAUDE.md', 'context/roadmap.md', 'context/ui/tokens.md', 'context/specs/.gitkeep']) {
    assert.ok(fs.existsSync(path.join(dir, rel)), rel);
  }
  assert.ok(!fs.existsSync(path.join(dir, 'context/known-issues.md')));
  assert.ok(!fs.existsSync(path.join(dir, 'context/contracts.md')));
  assert.ok(!fs.existsSync(path.join(dir, 'CLAUDE.local.md')));
  assert.match(read(dir, 'AGENTS.md'), /^# demo/);
  assert.match(read(dir, 'CLAUDE.md'), /## Design/);
  assert.doesNotMatch(read(dir, 'CLAUDE.md'), /UI projects only/);
  assert.equal(JSON.parse(read(dir, '.claude/settings.json')).enabledPlugins['pantoo@pantoo-ai'], true);
  assert.match(read(dir, '.gitignore'), /^context\/session\.md$/m);
  assert.match(read(dir, '.gitignore'), /^\.taste-skill\/$/m);
  assert.match(read(dir, '.gitignore'), /^\.env\*\n!\.env\.example$/m);
  assert.equal(JSON.parse(read(dir, '.pantoo.json')).layout, 2);
  assert.match(read(dir, '.gitattributes'), /^\* text=auto eol=lf$/m);
  assert.match(read(dir, '.gitattributes'), /^\*\.png binary$/m);
});

test('backend project drops UI files and the Design section', () => {
  const dir = tmp();
  scaffold(dir, { ...base, kind: 'backend', ui: false, existing: true, multiSurface: true });
  assert.ok(!fs.existsSync(path.join(dir, 'context/ui')));
  assert.ok(fs.existsSync(path.join(dir, 'context/known-issues.md')));
  assert.ok(fs.existsSync(path.join(dir, 'context/contracts.md')));
  assert.doesNotMatch(read(dir, 'CLAUDE.md'), /## Design/);
  assert.match(read(dir, 'CLAUDE.md'), /## Exceptions to global rules[\s\S]*\{\{EXCEPTIONS\}\}/);
  assert.doesNotMatch(read(dir, '.gitignore'), /taste/);
  assert.match(read(dir, 'AGENTS.md'), /known-issues\.md/);
});

test('never overwrites, and leaves a v1 context for migration', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'mine');
  fs.writeFileSync(path.join(dir, '.gitattributes'), '*.sh eol=lf\n');
  fs.mkdirSync(path.join(dir, 'context'));
  fs.writeFileSync(path.join(dir, 'context/progress-tracker.md'), 'v1');
  const results = scaffold(dir, base);
  assert.equal(read(dir, 'CLAUDE.md'), 'mine');
  assert.equal(read(dir, '.gitattributes'), '*.sh eol=lf\n');
  assert.ok(!fs.existsSync(path.join(dir, 'context/roadmap.md')));
  assert.ok(!fs.existsSync(path.join(dir, 'AGENTS.md')));
  assert.equal(JSON.parse(read(dir, '.pantoo.json')).layout, 1);
  assert.ok(results.some((r) => r.what === 'context/' && /migrate/.test(r.note)));
});

test('local mode hides everything in .git/info/exclude', () => {
  const dir = tmp();
  spawnSync('git', ['init', '-q', dir]);
  scaffold(dir, { ...base, local: true, share: false });
  assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.local.md')));
  assert.ok(!fs.existsSync(path.join(dir, 'CLAUDE.md')));
  assert.ok(!fs.existsSync(path.join(dir, '.gitignore')));
  assert.ok(!fs.existsSync(path.join(dir, '.gitattributes')));
  assert.ok(!fs.existsSync(path.join(dir, '.claude/settings.json')));
  // Hidden at any depth, since taste may build in a folder below the root.
  fs.mkdirSync(path.join(dir, 'site/.taste-skill'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'site/.taste-skill/build.json'), '{}');
  const status = spawnSync('git', ['-C', dir, 'status', '--porcelain'], { encoding: 'utf8' }).stdout;
  assert.equal(status, '');
});

test('local mode writes one exclude line per kit path, leaving tracked ones out', () => {
  const dir = tmp();
  spawnSync('git', ['init', '-q', dir]);
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'the team\'s');
  spawnSync('git', ['-C', dir, 'add', 'AGENTS.md']);
  scaffold(dir, { ...base, local: true, share: false });
  const lines = read(dir, '.git/info/exclude').split('\n').filter((l) => l && !l.startsWith('#'));
  assert.deepEqual(lines, [
    '/context/', '/CLAUDE.md', '/CLAUDE.local.md', '/DESIGN.md', '/PRODUCT.md', '/.pantoo.json',
    '/skills-lock.json', '/.claude/', '/.impeccable/', '/.impeccable-live/', '.taste-skill/',
    '.env*', '!.env.example',
  ]);
});

test('env files stay out of git, the example stays in, and a rerun adds nothing', () => {
  const dir = tmp();
  spawnSync('git', ['init', '-q', dir]);
  scaffold(dir, base);
  const once = read(dir, '.gitignore');
  scaffold(dir, base);
  assert.equal(read(dir, '.gitignore'), once);
  for (const f of ['.env', '.env.local', '.env.example']) fs.writeFileSync(path.join(dir, f), 'K=1\n');
  const ignored = (f) => spawnSync('git', ['-C', dir, 'check-ignore', '-q', f]).status === 0;
  assert.ok(ignored('.env') && ignored('.env.local'));
  assert.ok(!ignored('.env.example'));
});

test('an existing `!.env.example` above a missing `.env*` stays in force', () => {
  const dir = tmp();
  spawnSync('git', ['init', '-q', dir]);
  fs.writeFileSync(path.join(dir, '.gitignore'), '.env\n.env.*\n!.env.example\n');
  scaffold(dir, base);
  fs.writeFileSync(path.join(dir, '.env.example'), 'K=\n');
  assert.notEqual(spawnSync('git', ['-C', dir, 'check-ignore', '-q', '.env.example']).status, 0);
  assert.match(read(dir, '.gitignore'), /\.env\*\n!\.env\.example\n$/);
});

test('doctor: Node minimum compares the full version', async () => {
  const { nodeAtLeast, MIN_NODE } = await import('../src/node-version.js');
  const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.engines.node, `>=${MIN_NODE}`);
  assert.ok(nodeAtLeast('22.20.0', '22.20.0'));
  assert.ok(nodeAtLeast('24.1.0', '22.20.0'));
  assert.ok(!nodeAtLeast('22.19.9', '22.20.0'));
  assert.ok(!nodeAtLeast('20.18.0', '22.20.0'));
});

// The grep is one shell command, so it carries its own copy of the list. `*.md` covers the .md paths.
test('review-change\'s grep skips every kit path', () => {
  const skill = fs.readFileSync(path.join(templatesDir, '../skills/review-change/SKILL.md'), 'utf8');
  const command = skill.split('\n').find((l) => l.includes('git diff --no-ext-diff'));
  const excluded = [...command.matchAll(/':\(exclude(?:,glob)?\)([^']+)'/g)].map((m) => m[1]);
  const wanted = Object.entries(MANIFEST.kitPaths)
    .filter(([rel]) => !rel.endsWith('.md'))
    .map(([rel, depth]) => (depth === 'root' ? rel.replace(/\/$/, '') : `**/${rel}**`));
  assert.deepEqual(excluded.sort(), ['*.md', ...wanted].sort());
});

const gitIn = (dir, ...args) => {
  const r = spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};
// A repo whose own git config converts nothing, so the bytes written here are the bytes committed.
const repo = () => {
  const dir = tmp();
  gitIn(dir, 'init', '-q');
  gitIn(dir, 'config', 'core.autocrlf', 'false');
  return dir;
};
const put = (dir, rel, text) => fs.writeFileSync(path.join(dir, rel), text);
const warned = (checks) => checks.filter((c) => c.level === 'warn').map((c) => c.what);

test('doctor warns on a repo with no .gitattributes, except a local-only one', () => {
  const dir = repo();
  assert.deepEqual(warned(lineEndingChecks(dir)), ['.gitattributes']);
  assert.deepEqual(lineEndingChecks(dir, { local: true }), []);
  scaffold(dir, base);
  assert.deepEqual(lineEndingChecks(dir).map((c) => [c.level, c.what]), [['ok', 'line endings']]);
  fs.mkdirSync(path.join(dir, 'apps/web'), { recursive: true });
  assert.deepEqual(warned(lineEndingChecks(path.join(dir, 'apps/web'))), []);
});

test('doctor warns on a CRLF working file, but not on one that asks for CRLF', () => {
  const dir = repo();
  scaffold(dir, base);
  put(dir, 'a b.txt', 'one\n');
  put(dir, 'run.bat', 'one\r\n');
  gitIn(dir, 'add', '-A');
  assert.deepEqual(warned(lineEndingChecks(dir)), []);
  put(dir, 'a b.txt', 'one\r\n');
  const checks = projectChecks(dir, profile(tmp()));
  const row = checks.find((c) => c.what === 'line endings');
  assert.equal(row.level, 'warn');
  assert.match(row.note, /1 file\(s\), e\.g\. a b\.txt.*doctor --fix line-endings/);
});

test('doctor points files committed with CRLF at renormalize', () => {
  const dir = repo();
  put(dir, 'a.txt', 'one\r\n');
  gitIn(dir, 'add', '-A');
  const row = lineEndingChecks(dir).find((c) => c.what === 'line endings in git');
  assert.match(row.note, /renormalize/);
});

test('a clone with core.autocrlf on still checks out LF', () => {
  const dir = repo();
  scaffold(dir, base);
  gitIn(dir, 'add', '-A');
  gitIn(dir, 'commit', '-qm', 'start');
  const clone = path.join(tmp(), 'clone');
  gitIn(dir, '-c', 'core.autocrlf=true', 'clone', '-q', '-c', 'core.autocrlf=true', dir, clone);
  assert.doesNotMatch(read(clone, 'AGENTS.md'), /\r/);
  assert.deepEqual(warned(lineEndingChecks(clone)), []);
});

test('doctor warns a UI project without copy.md, and only a UI project', () => {
  const copy = (dir) => projectChecks(dir, profile(tmp())).find((c) => c.what === 'context/copy.md');
  const dir = tmp();
  scaffold(dir, base);
  assert.match(read(dir, 'context/copy.md'), /\{\{VARIANT\}\}/);
  assert.equal(copy(dir), undefined);
  fs.rmSync(path.join(dir, 'context/copy.md'));
  assert.equal(copy(dir).level, 'warn');
  assert.match(copy(dir).note, /start-project/);
  const backend = tmp();
  scaffold(backend, { ...base, kind: 'backend', ui: false });
  assert.ok(!fs.existsSync(path.join(backend, 'context/copy.md')));
  assert.equal(copy(backend), undefined);
});

test('mobile: UI files and the design-system companion, no automations.md', () => {
  const dir = tmp();
  scaffold(dir, { ...base, kind: 'mobile' });
  assert.ok(fs.existsSync(path.join(dir, 'context/ui/tokens.md')));
  assert.ok(fs.existsSync(path.join(dir, 'context/copy.md')));
  assert.ok(!fs.existsSync(path.join(dir, 'context/automations.md')));
  assert.match(read(dir, 'CLAUDE.md'), /## Design/);
  assert.deepEqual(JSON.parse(read(dir, '.pantoo.json')).companions, ['design-system']);
});

test('automation: automations.md and its AGENTS row, no UI files or companions', () => {
  const dir = tmp();
  scaffold(dir, { ...base, kind: 'automation', ui: false });
  assert.match(read(dir, 'context/automations.md'), /## \{\{NAME\}\}[\s\S]*### Tools and credentials[\s\S]*### Tests/);
  assert.match(read(dir, 'AGENTS.md'), /\| `context\/automations\.md` \|[^\n]*\n\| `context\/specs\/`/);
  assert.ok(!fs.existsSync(path.join(dir, 'context/ui')));
  assert.ok(!fs.existsSync(path.join(dir, 'context/copy.md')));
  assert.doesNotMatch(read(dir, 'CLAUDE.md'), /## Design/);
  const record = JSON.parse(read(dir, '.pantoo.json'));
  assert.equal(record.kind, 'automation');
  assert.deepEqual(record.companions, []);
  const local = tmp();
  spawnSync('git', ['init', '-q', local]);
  scaffold(local, { ...base, kind: 'automation', ui: false, local: true, share: false });
  assert.match(read(local, 'CLAUDE.local.md'), /`context\/automations\.md`/);
  const web = tmp();
  scaffold(web, base);
  assert.doesNotMatch(read(web, 'AGENTS.md'), /automations/);
});

test('doctor warns an automation project without automations.md, and only that kind', () => {
  const check = (dir) => projectChecks(dir, profile(tmp())).find((c) => c.what === 'context/automations.md');
  const dir = tmp();
  scaffold(dir, { ...base, kind: 'automation', ui: false });
  assert.equal(check(dir), undefined);
  fs.rmSync(path.join(dir, 'context/automations.md'));
  assert.equal(check(dir).level, 'warn');
  assert.match(check(dir).note, /start-project/);
  const backend = tmp();
  scaffold(backend, { ...base, kind: 'backend', ui: false });
  assert.equal(check(backend), undefined);
});

test('a web app with components.json gets no ui-styling companion', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'components.json'), '{}');
  scaffold(dir, base);
  assert.ok(!JSON.parse(read(dir, '.pantoo.json')).companions.includes('ui-styling'));
});
