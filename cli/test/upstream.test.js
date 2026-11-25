import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from '../src/index.js';
import { profile } from '../src/paths.js';
import { TOOLS } from '../src/third-party.js';
import { checkUpstream } from '../src/upstream.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-up-'));
const { impeccable, taste } = TOOLS;
const uiux = TOOLS['ui-ux-pro-max'];
const { emil } = TOOLS;
const bump = (tag) => tag.replace(/\d+$/, (n) => String(Number(n) + 1));
const refs = (...tags) => tags.map((t) => ({ ref: `refs/tags/${t}` }));

// What GitHub would answer, by API path.
const upstream = ({ impeccableTags = [impeccable.tag], tasteTags = [taste.tag], head = uiux.sha, emilHead = emil.sha } = {}) => ({
  [`repos/${impeccable.repo}/git/matching-refs/tags/skill-v`]: refs(...impeccableTags),
  [`repos/${taste.repo}/git/matching-refs/tags/v`]: refs(...tasteTags),
  [`repos/${uiux.repo}/commits/HEAD`]: { sha: head },
  [`repos/${emil.repo}/commits/HEAD`]: { sha: emilHead },
});
const web = (answers, seen = []) => async (url) => {
  seen.push(url);
  const body = answers[url.replace('https://api.github.com/', '')];
  return { ok: Boolean(body), status: body ? 200 : 404, json: async () => body };
};
// `gh` not logged in, and npm answering.
const anonymous = (cmd) => (cmd === 'npm' ? { ok: true, out: 'npm warn something\n4.11.0' } : { ok: false, out: 'not logged in' });
const check = (over = {}) => checkUpstream({ prof: profile(tmp()), run: anonymous, fetch: web(upstream()), ...over });

test('upstream at the pins is ok', async () => {
  const rows = await check();
  assert.deepEqual(rows.map((r) => r.level), ['ok', 'ok', 'ok', 'ok']);
  assert.match(rows[0].note, /skill-v4.*npm installer 4\.11\.0/);
});

test('a newer tag or commit is reported; older tags, pre-releases and other names are not', async () => {
  const rows = await check({ fetch: web(upstream({
    impeccableTags: ['skill-v4.9.0', bump(impeccable.tag), 'skill-v99.0.0-beta'],
    tasteTags: ['v1.0.0', taste.tag, 'v-next', 'v9.0.0\u001b[2J'],
    head: 'b'.repeat(40),
  })) });
  assert.deepEqual(rows.map((r) => r.level), ['warn', 'ok', 'warn', 'ok']);
  assert.ok(rows[0].note.includes(`upstream has ${bump(impeccable.tag)}`));
  assert.ok(rows[1].note.endsWith(taste.tag));
  assert.match(rows[2].note, /moved to main@bbbbbbb/);
});

test('a logged-in gh is used instead of anonymous HTTPS', async () => {
  const answers = upstream();
  const run = (cmd, args) => {
    if (cmd === 'npm') return anonymous(cmd);
    return { ok: true, out: args[0] === 'api' ? JSON.stringify(answers[args[1]]) : '' };
  };
  const rows = await check({ run, fetch: () => assert.fail('fetched') });
  assert.deepEqual(rows.map((r) => r.level), ['ok', 'ok', 'ok', 'ok']);
});

test('a failing gh falls back to HTTPS', async () => {
  const seen = [];
  const run = (cmd, args) => (cmd === 'gh' && args[0] === 'auth' ? { ok: true, out: '' } : anonymous(cmd));
  const rows = await check({ run, fetch: web(upstream(), seen) });
  assert.equal(seen.length, 4);
  assert.deepEqual(rows.map((r) => r.level), ['ok', 'ok', 'ok', 'ok']);
});

test('offline says so for each tool and doesn\'t throw', async () => {
  const rows = await check({ run: () => ({ ok: false, out: '' }), fetch: async () => { throw new Error('fetch failed'); } });
  assert.equal(rows.length, 4);
  for (const r of rows) assert.match(r.note, /could not check upstream \(fetch failed\)/);
});

test('update --check shows holds, installs and writes nothing, and doesn\'t fail offline', async () => {
  const home = tmp();
  const prof = profile(home);
  fs.mkdirSync(path.dirname(prof.configFile), { recursive: true });
  const config = JSON.stringify({ holds: { taste: taste.previous[0].sha } });
  fs.writeFileSync(prof.configFile, config);
  const calls = [];
  const run = (cmd, args) => { calls.push([cmd, ...args].join(' ')); return { ok: false, out: '' }; };
  const out = [];
  const log = console.log;
  console.log = (line) => out.push(line);
  try {
    await main(['update', '--check', '--home', home], { run, fetch: async () => { throw new Error('offline'); } });
  } finally {
    console.log = log;
  }
  assert.deepEqual(calls, ['gh auth status']);
  assert.equal(fs.readFileSync(prof.configFile, 'utf8'), config);
  assert.deepEqual(fs.readdirSync(home), ['.pantoo']);
  assert.ok(out.some((l) => l.includes(`taste: pinned ${taste.tag}, held at ${taste.previous[0].tag}`)));
  assert.notEqual(process.exitCode, 1);
  await assert.rejects(main(['update', '--check', '--hold', 'taste', '--home', home], { run }), /changes nothing/);
});
