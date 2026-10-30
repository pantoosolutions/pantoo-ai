import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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
  assert.equal(JSON.parse(read(dir, '.pantoo.json')).layout, 2);
});

test('backend project drops UI files and the Design section', () => {
  const dir = tmp();
  scaffold(dir, { ...base, kind: 'backend', ui: false, existing: true, multiSurface: true });
  assert.ok(!fs.existsSync(path.join(dir, 'context/ui')));
  assert.ok(fs.existsSync(path.join(dir, 'context/known-issues.md')));
  assert.ok(fs.existsSync(path.join(dir, 'context/contracts.md')));
  assert.doesNotMatch(read(dir, 'CLAUDE.md'), /## Design/);
  assert.match(read(dir, 'AGENTS.md'), /known-issues\.md/);
});

test('never overwrites, and leaves a v1 context for migration', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'mine');
  fs.mkdirSync(path.join(dir, 'context'));
  fs.writeFileSync(path.join(dir, 'context/progress-tracker.md'), 'v1');
  const results = scaffold(dir, base);
  assert.equal(read(dir, 'CLAUDE.md'), 'mine');
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
  assert.ok(!fs.existsSync(path.join(dir, '.claude/settings.json')));
  const status = spawnSync('git', ['-C', dir, 'status', '--porcelain'], { encoding: 'utf8' }).stdout;
  assert.equal(status, '');
});
