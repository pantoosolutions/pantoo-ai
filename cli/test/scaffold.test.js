import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { lineEndingChecks, projectChecks } from '../src/doctor.js';
import { profile } from '../src/paths.js';
import { scaffold } from '../src/scaffold.js';

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
  assert.match(row.note, /1 file\(s\), e\.g\. a b\.txt.*move import/);
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
