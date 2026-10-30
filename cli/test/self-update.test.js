import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { marketplaceChecks } from '../src/doctor.js';
import { profile } from '../src/paths.js';
import { newer, selfUpdate } from '../src/self-update.js';

const reply = (version) => async () => ({ ok: true, json: async () => ({ version }) });
const base = (over = {}) => ({ args: ['--dir', 'x'], env: {}, version: '0.7.5', isClone: false, warn: () => {}, run: () => 0, ...over });

test('newer compares x.y.z numerically', () => {
  assert.ok(newer('0.10.0', '0.9.9'));
  assert.ok(!newer('0.7.5', '0.7.5'));
  assert.ok(!newer('0.7.4', '0.7.5'));
});

test('newer on npm re-runs update with the same args and the guard env', async () => {
  let call;
  const code = await selfUpdate(base({ fetch: reply('0.8.0'), run: (a, env) => { call = { a, env }; return 3; } }));
  assert.equal(code, 3);
  assert.deepEqual(call.a, ['--yes', 'pantoo-ai@0.8.0', 'update', '--dir', 'x']);
  assert.equal(call.env.PANTOO_AI_NO_SELF_UPDATE, '1');
});

test('a registry version that is not x.y.z is ignored with a warning', async () => {
  const warns = [];
  for (const v of ['9.9.9; rm -rf /', '1.2', 'latest']) {
    assert.equal(await selfUpdate(base({ fetch: reply(v), warn: (m) => warns.push(m), run: () => assert.fail('ran') })), null);
  }
  assert.equal(warns.length, 3);
});

test('npx that cannot start warns and lets the local update run', async () => {
  const warns = [];
  assert.equal(await selfUpdate(base({ fetch: reply('0.8.0'), warn: (m) => warns.push(m), run: () => null })), null);
  assert.match(warns[0], /could not run pantoo-ai@0\.8\.0; continuing with this version/);
});

test('same or older version on npm does not re-run', async () => {
  for (const v of ['0.7.5', '0.7.0']) {
    assert.equal(await selfUpdate(base({ fetch: reply(v), run: () => assert.fail('ran') })), null);
  }
});

test('offline warns and continues', async () => {
  const warns = [];
  const code = await selfUpdate(base({ fetch: async () => { throw new Error('offline'); }, warn: (m) => warns.push(m), run: () => assert.fail('ran') }));
  assert.equal(code, null);
  assert.equal(warns.length, 1);
});

test('guards skip the fetch entirely', async () => {
  const fetch = () => assert.fail('fetched');
  assert.equal(await selfUpdate(base({ fetch, env: { PANTOO_AI_NO_SELF_UPDATE: '1' } })), null);
  assert.equal(await selfUpdate(base({ fetch, isClone: true })), null);
  assert.equal(await selfUpdate(base({ fetch, args: ['--no-self-update'] })), null);
});

function homeWith(entry) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-mk-'));
  if (entry) {
    fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'plugins', 'known_marketplaces.json'), JSON.stringify({ 'pantoo-ai': entry }));
  }
  return profile(home);
}

test('doctor warns on a directory marketplace', () => {
  const rows = marketplaceChecks(homeWith({ source: { source: 'directory', path: '/x/pantoo-ai' } }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].level, 'warn');
  assert.match(rows[0].note, /dev mode/);
});

test('doctor is ok on a github marketplace', () => {
  const rows = marketplaceChecks(homeWith({ source: { source: 'github', repo: 'pantoosolutions/pantoo-ai' } }), 'pantoosolutions/pantoo-ai');
  assert.deepEqual(rows.map((r) => r.level), ['ok']);
});

test('doctor does not warn on a GitHub URL or owner/repo#ref marketplace', () => {
  for (const saved of ['https://github.com/pantoosolutions/pantoo-ai', 'pantoosolutions/pantoo-ai#main']) {
    const rows = marketplaceChecks(homeWith({ source: { source: 'github', repo: 'pantoosolutions/pantoo-ai' } }), saved);
    assert.deepEqual(rows.map((r) => r.level), ['ok']);
  }
});

test('doctor warns when the saved marketplace is an existing local path, with no && in the fix', () => {
  const rows = marketplaceChecks(homeWith(null), os.tmpdir());
  assert.equal(rows[0].level, 'warn');
  assert.ok(!rows[0].note.includes('&&'));
});

test('doctor ignores a corrupt known_marketplaces.json', () => {
  const prof = homeWith({ source: { source: 'github', repo: 'a/b' } });
  fs.writeFileSync(path.join(prof.claudeDir, 'plugins', 'known_marketplaces.json'), '{nope');
  assert.deepEqual(marketplaceChecks(prof), []);
});

test('doctor adds no row without a known marketplaces file', () => {
  assert.deepEqual(marketplaceChecks(homeWith(null)), []);
});
