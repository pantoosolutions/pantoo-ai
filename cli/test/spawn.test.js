import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { spawnOptions } from '../src/spawn.js';

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
