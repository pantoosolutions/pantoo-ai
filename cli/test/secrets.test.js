import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { profile } from '../src/paths.js';
import { secretChecks, validSecrets } from '../src/secrets.js';

const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-sec-')));
const put = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const record = (dir, secrets) => put(path.join(dir, '.pantoo.json'), JSON.stringify({ layout: 2, name: 'demo', secrets }));

test('validSecrets drops paths outside home and the project, and keeps the rest', () => {
  const root = tmp();
  const home = tmp();
  const { secrets, warns } = validSecrets({
    secrets: [
      { name: 'passwd', file: '/etc/passwd' },
      { name: 'up', file: '../../x' },
      { name: 'win', file: 'C:\\x' },
      { name: 'cfg', file: '~/.config/x' },
      { name: 'dotenv', file: '.env.local' },
      { name: 'both', file: ['~/a', '/abs'], env: 'API_TOKEN' },
      { name: 'bad env', env: 'not-valid' },
      { name: 'bad name!', env: 'X' },
    ],
  }, { root, home });
  assert.deepEqual(secrets.map((s) => s.name), ['cfg', 'dotenv', 'both']);
  assert.equal(secrets[0].files[0].abs, path.join(home, '.config', 'x'));
  assert.equal(secrets[1].files[0].project, '.env.local');
  assert.deepEqual(secrets[2].files.map((f) => f.written), ['~/a']);
  const named = warns.map((w) => w.what);
  for (const n of ['secret passwd', 'secret up', 'secret win', 'secret bad env', '.pantoo.json secrets[7]']) assert.ok(named.includes(n), n);
});

test('a secret file is never opened, and an env value is never printed', { skip: process.platform === 'win32' && 'chmod 000 has no effect on Windows' }, (t) => {
  const dir = tmp();
  const prof = profile(tmp());
  const file = path.join(prof.home, '.config', 'tool', 'token');
  put(file, 'the-secret-value');
  fs.chmodSync(file, 0o000);
  t.after(() => fs.chmodSync(file, 0o600));
  record(dir, [{ name: 'tool', file: '~/.config/tool/token' }, { name: 'api', env: 'API_TOKEN' }, { name: 'gone', env: 'NOT_SET', note: 'from the team vault' }]);
  const opened = [];
  for (const fn of ['readFileSync', 'openSync']) {
    const real = fs[fn];
    t.mock.method(fs, fn, (p, ...rest) => { opened.push(String(p)); return real.call(fs, p, ...rest); });
  }
  const checks = secretChecks(dir, prof, { API_TOKEN: 's3cr3t-env-value' });
  assert.ok(opened.some((p) => p.endsWith('.pantoo.json')), 'the spy saw no reads at all');
  assert.ok(!opened.includes(file), 'the secret file was opened');
  const row = (name) => checks.find((c) => c.what === `secret ${name}`);
  assert.equal(row('tool').level, 'ok');
  assert.equal(row('api').level, 'ok');
  assert.equal(row('gone').level, 'warn');
  assert.match(row('gone').note, /set NOT_SET.*team vault/);
  const out = JSON.stringify(checks);
  assert.ok(!out.includes('s3cr3t-env-value'));
  assert.ok(!out.includes('the-secret-value'));
});

test('a committed secret file fails', () => {
  const dir = tmp();
  spawnSync('git', ['init', '-q', dir]);
  put(path.join(dir, '.env.local'), 'KEY=1\n');
  spawnSync('git', ['-C', dir, 'add', '.env.local']);
  record(dir, [{ name: 'dotenv', file: '.env.local' }]);
  const [row] = secretChecks(dir, profile(tmp()), {});
  assert.equal(row.level, 'fail');
  assert.match(row.note, /committed: rotate it, then `git rm --cached \.env\.local`/);
});

test('a secret path from the repo prints without hidden characters', () => {
  const dir = tmp();
  const hidden = String.fromCharCode(27);
  record(dir, [{ name: 'k', file: `~/a${hidden}]0;title${String.fromCharCode(0x202e)}` }]);
  const [row] = secretChecks(dir, profile(tmp()), {});
  assert.match(row.note, /missing: create ~\/a/);
  assert.doesNotMatch(row.note, /[\p{Cc}\p{Cf}]/u);
});
