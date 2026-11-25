import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { git, spawnOptions } from '../src/spawn.js';
import { profile } from '../src/paths.js';

test('commands run from home and never search the current folder for a program', () => {
  const plain = spawnOptions();
  assert.equal(plain.cwd, os.homedir());
  assert.equal(plain.env.NoDefaultCurrentDirectoryInExePath, '1');
  // Windows spells it `Path`; a copied env keeps the spelling.
  const pathKey = Object.keys(plain.env).find((k) => k.toUpperCase() === 'PATH');
  assert.equal(plain.env[pathKey], process.env.PATH);
  const given = spawnOptions({ cwd: '/somewhere', env: { A: 'b' } });
  assert.equal(given.cwd, '/somewhere');
  assert.deepEqual(given.env, { A: 'b', NoDefaultCurrentDirectoryInExePath: '1' });
});

test('only spawn.js starts processes, so no call skips those rules', () => {
  const src = new URL('../src/', import.meta.url);
  const users = fs.readdirSync(src, { recursive: true })
    .filter((f) => f.endsWith('.js') && /child_process/.test(fs.readFileSync(new URL(f, src), 'utf8')));
  assert.deepEqual(users, ['spawn.js']);
});

test('git check-ignore answers through the git helper', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-ign-'));
  spawnSync('git', ['init', '-q', dir]);
  fs.writeFileSync(path.join(dir, '.gitignore'), 'context/session.md\n');
  assert.ok(git(dir, ['check-ignore', '-q', '--', 'context/session.md']).ok);
  assert.ok(!git(dir, ['check-ignore', '-q', '--', 'context/overview.md']).ok);
  // Other commands keep literal pathspecs: `*` matches no file here.
  fs.writeFileSync(path.join(dir, 'a.txt'), 'x');
  spawnSync('git', ['-C', dir, 'add', 'a.txt']);
  assert.equal(git(dir, ['ls-files', '--', '*.txt']).out, '');
});

test('--home moves HOME and USERPROFILE, so Node children use that profile on every OS', () => {
  const root = path.resolve('somewhere-else');
  const { env } = profile(root);
  assert.equal(env.HOME, root);
  assert.equal(env.USERPROFILE, root);
  assert.equal(env.CLAUDE_CONFIG_DIR, path.join(root, '.claude'));
  assert.equal(profile().env, process.env);
});
