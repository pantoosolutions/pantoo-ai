import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectChecks } from '../src/doctor.js';
import { main } from '../src/index.js';
import { profile } from '../src/paths.js';
import { scaffold } from '../src/scaffold.js';
import { SOURCES, addSource, readSources, sourceChecks } from '../src/sources.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-src-'));
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const json = (dir, rel) => JSON.parse(read(dir, rel));
const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
const base = { name: 'demo', kind: 'web-app', ui: true, existing: false, multiSurface: false, local: false, share: false };
const project = (choices = {}) => { const dir = tmp(); scaffold(dir, { ...base, ...choices }); return dir; };
const prof = () => profile(tmp());
const quiet = async (fn) => { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } };
const check = (checks, what) => checks.find((c) => c.what === what);

test('every known tool is well formed', () => {
  for (const [id, t] of Object.entries(SOURCES.tools)) {
    assert.ok(t.ways.length && t.ways.every((w) => SOURCES.ways.includes(w)), id);
    if (t.mcp) assert.ok(t.ways.includes('mcp') && t.mcp.server.type === 'http' && t.mcp.signIn, id);
    assert.match(t.checked, /^\d{4}-\d{2}-\d{2}$/, id);
  }
});

test('add source writes the server, keeps other servers, and records a row once', () => {
  const dir = project();
  write(dir, '.mcp.json', JSON.stringify({ mcpServers: { other: { type: 'http', url: 'https://x.test/mcp' } } }));
  addSource({ name: 'figma', dir });
  const again = addSource({ name: 'figma', dir });
  const servers = json(dir, '.mcp.json').mcpServers;
  assert.deepEqual(servers.figma, SOURCES.tools.figma.mcp.server);
  assert.ok(servers.other);
  assert.deepEqual(again.map((r) => r.status), ['unchanged', 'unchanged']);
  assert.deepEqual(readSources(dir).map((r) => [r.tool, r.way]), [['figma', 'mcp']]);
});

test('a tool without an MCP server gets a row and no .mcp.json', () => {
  const dir = project();
  const rows = addSource({ name: 'claude-design', dir });
  assert.equal(rows[0].status, 'no MCP server');
  assert.ok(!fs.existsSync(path.join(dir, '.mcp.json')));
  assert.equal(readSources(dir)[0].way, 'code');
});

test('an older README gets the Sources section before the row', () => {
  const dir = project();
  write(dir, 'context/designs/README.md', 'Old notes.\n');
  assert.equal(readSources(dir), null);
  addSource({ name: 'sketch', dir });
  assert.match(read(dir, 'context/designs/README.md'), /^Old notes\.\n\n## Sources/);
  assert.equal(readSources(dir)[0].tool, 'sketch');
});

test('unknown tool and missing project are errors', () => {
  assert.throws(() => addSource({ name: 'figma', dir: tmp() }), /npx pantoo-ai new/);
  assert.throws(() => addSource({ name: 'paint', dir: project() }), /Known: figma/);
});

test('local projects hide .mcp.json in .git/info/exclude', () => {
  const dir = tmp();
  spawnSync('git', ['init', '-q', dir]);
  scaffold(dir, { ...base, local: true });
  addSource({ name: 'figma', dir });
  assert.equal(spawnSync('git', ['-C', dir, 'status', '--porcelain'], { encoding: 'utf8' }).stdout, '');
});

test('doctor: mcp row without a server fails, with one passes, other ways pass', () => {
  const dir = project();
  const p = prof();
  write(dir, 'context/designs/README.md', `${read(dir, 'context/designs/README.md')}| figma | mcp | https://figma.com/design/abc | v3 | 2026-10-28 | Ana |\n| brand kit | tokens | ../kit/DESIGN.md | v1.0 | 2026-10-28 | Jaime |\n`);
  assert.equal(check(sourceChecks(dir, p, { ui: true }), 'design source figma').level, 'fail');
  assert.equal(check(sourceChecks(dir, p, { ui: true }), 'design source brand kit').level, 'ok');
  addSource({ name: 'figma', dir });
  assert.equal(check(projectChecks(dir, p), 'design source figma').level, 'ok');
});

test('doctor: a server only in ~/.claude.json warns; unknown way warns; no table warns', () => {
  const dir = project();
  const p = prof();
  write(dir, 'context/designs/README.md', `${read(dir, 'context/designs/README.md')}| figma | mcp | x | | | |\n| canva | carrier pigeon | x | | | |\n`);
  write(p.home, '.claude.json', JSON.stringify({ projects: { [dir]: { mcpServers: { figma: {} } } } }));
  const checks = sourceChecks(dir, p, { ui: true });
  assert.match(check(checks, 'design source figma').note, /local/);
  assert.equal(check(checks, 'design source canva').level, 'warn');
  write(dir, 'context/designs/README.md', 'No table.\n');
  assert.equal(check(sourceChecks(dir, p, { ui: true }), 'design sources').level, 'warn');
});

test('doctor: literal secrets in .mcp.json fail; ${VAR} passes', () => {
  const dir = project({ kind: 'backend', ui: false });
  const servers = {
    ok: { type: 'http', url: 'https://a.test/mcp?userToken=${KEY}', headers: { Authorization: 'Bearer ${TOKEN}' } },
    leaky: { type: 'http', url: 'https://a.test/mcp?userToken=abc123', headers: { 'X-Api-Key': 'abc' } },
  };
  write(dir, '.mcp.json', JSON.stringify({ mcpServers: servers }));
  const checks = sourceChecks(dir, prof(), { ui: false });
  assert.equal(checks.length, 1);
  assert.match(checks[0].note, /header X-Api-Key, url \?userToken/);
});

test('new --source sets up the source; add source runs from the CLI', async () => {
  const dir = tmp();
  await quiet(() => main(['new', '--yes', '--dir', dir, '--no-share', '--no-companions', '--source', 'penpot', '--home', tmp()], { run: () => ({ ok: true, out: '' }) }));
  assert.match(json(dir, '.mcp.json').mcpServers.penpot.url, /\$\{PENPOT_MCP_KEY\}/);
  await quiet(() => main(['add', 'source', 'sketch', '--dir', dir]));
  assert.deepEqual(readSources(dir).map((r) => r.tool), ['penpot', 'sketch']);
  await assert.rejects(main(['new', '--yes', '--dir', tmp(), '--source', 'paint']), /--source must be one of/);
});
