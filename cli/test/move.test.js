import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { doctor, repairLineEndings } from '../src/doctor.js';
import { CLASSES, MoveStop, exportMove, filterPermissions, importMove, memoryDir, normalRemote, readMoveFolder, slug, sshHostname } from '../src/move.js';
import { profile } from '../src/paths.js';
import { MANIFEST, excludeKitPaths } from '../src/scaffold.js';

const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-mv-')));
const put = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const read = (file) => fs.readFileSync(file, 'utf8');
const gitIn = (dir, ...args) => {
  const r = spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=/dev/null', ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};
const NO_ENV = {};

// A bare remote, clone A (profile A) with the project, clone B (profile B) fresh from the remote.
function fixture({ local = false } = {}) {
  const base = tmp();
  const remote = path.join(base, 'remote.git');
  gitIn(base, 'init', '-q', '--bare', '-b', 'main', remote);
  const a = path.join(base, 'a');
  fs.mkdirSync(a);
  gitIn(a, 'init', '-q', '-b', 'main');
  gitIn(a, 'config', 'core.autocrlf', 'false');
  put(path.join(a, '.gitattributes'), '* text=auto eol=lf\n');
  put(path.join(a, 'README.md'), 'hello\n');
  const project = { layout: 2, name: 'demo', kind: 'backend', ui: false, local, secrets: [{ name: 'api', env: 'API_TOKEN' }] };
  if (local) {
    gitIn(a, 'add', '-A');
    gitIn(a, 'commit', '-qm', 'start');
    excludeKitPaths(a);
    put(path.join(a, '.pantoo.json'), JSON.stringify(project));
    put(path.join(a, 'context', 'overview.md'), '# demo\n');
  } else {
    put(path.join(a, '.gitignore'), 'context/session.md\n.claude/settings.local.json\n');
    put(path.join(a, '.pantoo.json'), JSON.stringify(project));
    put(path.join(a, 'context', 'overview.md'), '# demo\n');
    gitIn(a, 'add', '-A');
    gitIn(a, 'commit', '-qm', 'start');
  }
  put(path.join(a, 'context', 'session.md'), 'where I stopped\n');
  gitIn(a, 'remote', 'add', 'origin', remote);
  gitIn(a, 'push', '-q', '-u', 'origin', 'main');
  const profA = profile(path.join(base, 'homeA'));
  const memA = memoryDir(profA, a, { env: NO_ENV }).dir;
  put(path.join(memA, 'MEMORY.md'), '- [Owner](owner.md) — decides alone\n');
  put(path.join(memA, 'owner.md'), 'the owner decides alone\n');
  put(path.join(a, '.claude', 'settings.local.json'), JSON.stringify({
    env: { SECRET: 'x' },
    permissions: {
      allow: ['Bash(npm test)', 'Bash(curl -H "Authorization: Bearer ghp_abcdefghijklmnop")', `Read(${a}/notes/**)`, 'WebFetch(domain:example.com)'],
      deny: ['Bash(rm -rf:*)'],
    },
  }));
  const b = path.join(base, 'b');
  gitIn(base, 'clone', '-q', '-c', 'core.autocrlf=false', remote, b);
  const profB = profile(path.join(base, 'homeB'));
  return { base, remote, a, b, profA, profB, to: path.join(base, 'move') };
}

const exp = (f) => exportMove({ prof: f.profA, dir: f.a, to: f.to, env: NO_ENV });
const imp = (f, opts = {}) => importMove({ prof: f.profB, dir: f.b, folder: f.to, env: NO_ENV, ...opts });
const memB = (f) => memoryDir(f.profB, f.b, { env: NO_ENV }).dir;

// Every file under the folders an import could touch, with its content.
function snapshot(...dirs) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[p] = read(p);
    }
  };
  for (const d of dirs) if (fs.existsSync(d)) walk(d);
  return out;
}

test('export then import: session.md and memory land on the new machine', async () => {
  const f = fixture();
  for (const junk of ['context/.DS_Store', 'context/specs/Thumbs.db', 'context/desktop.ini', 'context/._session.md']) put(path.join(f.a, junk), 'x');
  fs.appendFileSync(path.join(f.a, '.git', 'info', 'exclude'), '.DS_Store\nThumbs.db\ndesktop.ini\n._*\n');
  const r = exp(f);
  assert.deepEqual(r.manifest.files.map((x) => x.path), ['context/session.md']);
  assert.deepEqual(r.manifest.memory.map((x) => x.name).sort(), ['MEMORY.md', 'owner.md']);
  assert.deepEqual(r.manifest.secrets, [{ name: 'api', env: 'API_TOKEN' }]);
  assert.ok(!read(path.join(f.to, 'move.json')).includes('"SECRET"'));
  // An export from before the junk filter lists one; import skips it.
  const mj = JSON.parse(read(path.join(f.to, 'move.json')));
  put(path.join(f.to, 'files', 'context', '.DS_Store'), 'x');
  mj.files.push({ path: 'context/.DS_Store', sha256: crypto.createHash('sha256').update('x').digest('hex'), modified: mj.files[0].modified });
  fs.writeFileSync(path.join(f.to, 'move.json'), JSON.stringify(mj));
  put(path.join(memB(f), 'MEMORY.md'), '- [Mine](mine.md) — only here\n');
  const out = await imp(f);
  assert.ok(!fs.existsSync(path.join(f.b, 'context', '.DS_Store')));
  assert.equal(read(path.join(f.b, 'context', 'session.md')), 'where I stopped\n');
  assert.equal(read(path.join(memB(f), 'owner.md')), 'the owner decides alone\n');
  assert.equal(read(path.join(memB(f), 'MEMORY.md')), '- [Mine](mine.md) — only here\n- [Owner](owner.md) — decides alone\n');
  assert.equal(memB(f), path.join(f.profB.claudeDir, 'projects', slug(f.b), 'memory'));
  assert.deepEqual(out.pending.length, 1); // the permission list
  assert.equal(gitIn(f.b, 'status', '--porcelain'), '');
  const checks = doctor(f.profB, out.root, { user: false });
  assert.ok(checks.some((c) => c.what === 'secret api'));
  // A rerun with the same folder is safe.
  const again = await imp(f);
  assert.equal(read(path.join(memB(f), 'MEMORY.md')).split('\n').filter(Boolean).length, 2);
  assert.ok(again.lines.some((l) => /context\/session\.md: same/.test(l)));
});

test('a --local project: all of context travels and stays out of git', async () => {
  const f = fixture({ local: true });
  const r = exp(f);
  assert.deepEqual(r.manifest.files.map((x) => x.path).sort(), ['.pantoo.json', 'context/overview.md', 'context/session.md']);
  await imp(f);
  assert.equal(read(path.join(f.b, 'context', 'overview.md')), '# demo\n');
  assert.match(read(path.join(f.b, '.git', 'info', 'exclude')), /^\/context\/$/m);
  assert.equal(gitIn(f.b, 'status', '--porcelain'), '');
});

test('import stops on a missing HEAD, another remote or branch, and changes nothing', async () => {
  const f = fixture();
  exp(f);
  const watched = () => snapshot(f.b, f.profB.home);
  // A pushes a commit after B cloned, and exports again: B doesn't have it.
  put(path.join(f.a, 'NEW.md'), 'new\n');
  gitIn(f.a, 'add', 'NEW.md');
  gitIn(f.a, 'commit', '-qm', 'more');
  gitIn(f.a, 'push', '-q');
  fs.rmSync(f.to, { recursive: true });
  exp(f);
  let before = watched();
  await assert.rejects(imp(f), (e) => e instanceof MoveStop && /git fetch/.test(e.message));
  assert.deepEqual(watched(), before);

  gitIn(f.b, 'switch', '-q', '-c', 'other');
  before = watched();
  await assert.rejects(imp(f), /git switch main/);
  assert.deepEqual(watched(), before);
  gitIn(f.b, 'switch', '-q', 'main');

  const other = path.join(f.base, 'other.git');
  gitIn(f.base, 'init', '-q', '--bare', other);
  gitIn(f.b, 'remote', 'set-url', 'origin', other);
  before = watched();
  await assert.rejects(imp(f), /isn't the exported one/);
  assert.deepEqual(watched(), before);
});

test('a clone ahead of the exported HEAD goes on, with a note', async () => {
  const f = fixture();
  exp(f);
  put(path.join(f.b, 'LATER.md'), 'later\n');
  gitIn(f.b, 'add', 'LATER.md');
  gitIn(f.b, 'commit', '-qm', 'later');
  const out = await imp(f);
  assert.ok(out.lines.some((l) => /ahead of the exported commit/.test(l)));
  assert.ok(fs.existsSync(path.join(f.b, 'context', 'session.md')));
});

test('a memory file that differs is kept and listed, then replaced on --take or a yes', async () => {
  const f = fixture();
  exp(f);
  const mine = path.join(memB(f), 'owner.md');
  put(mine, 'my own version\n');
  const first = await imp(f);
  assert.equal(read(mine), 'my own version\n');
  assert.ok(first.pending.includes('--take memory/owner.md'));
  await imp(f, { take: ['owner.md'] });
  assert.equal(read(mine), 'the owner decides alone\n');
  assert.ok(fs.readdirSync(memB(f)).some((n) => n.startsWith('owner.md.bak-')));

  put(mine, 'changed again\n');
  const asked = [];
  await imp(f, { ask: { confirm: async (m) => { asked.push(m); return true; }, multiselect: async () => [] } });
  assert.equal(read(mine), 'the owner decides alone\n');
  assert.match(asked[0], /memory\/owner\.md differs/);
});

test('a permission is never added without a yes', async () => {
  const f = fixture();
  const r = exp(f);
  const perms = read(path.join(f.to, 'permissions.json'));
  assert.ok(!perms.includes('ghp_'));
  assert.ok(!perms.includes('"SECRET"'));
  assert.deepEqual(r.manifest.permissions.left, [`Read(${f.a}/notes/**)`]);
  const file = path.join(f.b, '.claude', 'settings.local.json');
  const out = await imp(f);
  assert.ok(!fs.existsSync(file));
  assert.ok(out.lines.some((l) => /2\. allow {2}WebFetch\(domain:example\.com\)/.test(l)));
  assert.ok(out.lines.some((l) => l.includes(`Read(${f.a}/notes/**)`)));
  await imp(f, { allow: '2' });
  assert.deepEqual(JSON.parse(read(file)).permissions, { allow: ['WebFetch(domain:example.com)'] });
  assert.equal(gitIn(f.b, 'status', '--porcelain'), '');
  await assert.rejects(imp(f, { allow: '9' }), /from 1 to 3/);
});

test('the export folder is untrusted', async () => {
  const f = fixture();
  exp(f);
  const manifestFile = path.join(f.to, 'move.json');
  const good = read(manifestFile);
  const edit = (fn) => { const m = JSON.parse(good); fn(m); fs.writeFileSync(manifestFile, JSON.stringify(m)); };
  for (const bad of ['../evil', '.git/hooks/x', '/etc/x', 'C:/x', 'context/../../x', 'src/app.js']) {
    edit((m) => { m.files[0].path = bad; });
    assert.throws(() => readMoveFolder(f.to), MoveStop, bad);
  }
  edit((m) => { m.memory[0].name = '../x.md'; });
  assert.throws(() => readMoveFolder(f.to), MoveStop);
  fs.writeFileSync(manifestFile, good);

  const session = path.join(f.to, 'files', 'context', 'session.md');
  fs.writeFileSync(session, 'tampered\n');
  assert.throws(() => readMoveFolder(f.to), /wait for Drive to finish syncing/);
  fs.rmSync(session);
  if (process.platform !== 'win32') {
    fs.symlinkSync(path.join(f.a, 'context', 'session.md'), session);
    assert.throws(() => readMoveFolder(f.to), /isn't a plain file/);
    fs.rmSync(session);
  }
  fs.writeFileSync(session, 'where I stopped\n');
  put(path.join(f.to, 'files', 'context', 'extra.md'), 'not listed\n');
  await imp(f);
  assert.ok(!fs.existsSync(path.join(f.b, 'context', 'extra.md')));
});

test('normalRemote: ssh, https and https with a token agree, and the token never travels', () => {
  const want = 'github.com/owner/repo';
  for (const url of ['git@github.com:Owner/Repo.git', 'https://github.com/owner/repo', 'https://ghp_tok@github.com/owner/repo.git', 'ssh://git@github.com/owner/repo.git', 'https://github.com/owner/repo/']) {
    assert.equal(normalRemote(url), want, url);
  }
  const f = fixture();
  gitIn(f.a, 'remote', 'set-url', 'origin', 'https://x-access:ghp_secrettoken@github.com/owner/repo.git');
  const r = exp(f);
  assert.equal(r.manifest.git.remote, want);
  assert.ok(!read(path.join(f.to, 'move.json')).includes('ghp_secrettoken'));
});

test('normalRemote: an ssh Host alias counts as its real host, and https is never resolved', () => {
  const alias = (h) => (h === 'github.com-work' ? 'github.com' : h);
  for (const url of ['git@github.com-work:owner/repo.git', 'ssh://git@github.com-work/owner/repo.git', 'https://github.com/owner/repo']) {
    assert.equal(normalRemote(url, { resolveHost: alias }), 'github.com/owner/repo', url);
  }
  const seen = [];
  normalRemote('https://github.com-work/owner/repo', { resolveHost: (h) => (seen.push(h), h) });
  assert.deepEqual(seen, []);
});

test('sshHostname reads the alias from an ssh config, and leaves odd names alone', (t) => {
  if (spawnSync('ssh', ['-V']).error) return t.skip('no ssh');
  const dir = tmp();
  const config = path.join(dir, 'config');
  put(config, 'Host github.com-work\n  HostName github.com\n  User git\n');
  assert.equal(sshHostname('github.com-work', { config }), 'github.com');
  assert.equal(sshHostname('gitlab.com', { config }), 'gitlab.com');
  assert.equal(sshHostname('-oProxyCommand=x', { config }), '-oProxyCommand=x');
});

test('export stops inside the repo, on a non-empty folder, and before a push', () => {
  const f = fixture();
  assert.throws(() => exportMove({ prof: f.profA, dir: f.a, to: path.join(f.a, 'out'), env: NO_ENV }), /inside the repo/);
  put(path.join(f.to, 'x'), 'x');
  assert.throws(() => exp(f), /isn't an empty folder/);
  fs.rmSync(f.to, { recursive: true });
  put(path.join(f.a, 'LOCAL.md'), 'x\n');
  gitIn(f.a, 'add', 'LOCAL.md');
  gitIn(f.a, 'commit', '-qm', 'not pushed');
  assert.throws(() => exp(f), /push first, then export/);
});

// The real case: a clone made with core.autocrlf=true before .gitattributes arrived. git wrote the
// CRLF files itself, so the tree is clean while they stay CRLF on disk.
test('repairLineEndings: a CRLF working copy comes back LF; a dirty tree or no .gitattributes skips', () => {
  const base = tmp();
  const src = path.join(base, 'src');
  fs.mkdirSync(src);
  gitIn(src, 'init', '-q', '-b', 'main');
  gitIn(src, 'config', 'core.autocrlf', 'false');
  put(path.join(src, 'a.txt'), 'one\ntwo\n');
  put(path.join(src, 'b b.txt'), 'x\n');
  gitIn(src, 'add', '-A');
  gitIn(src, 'commit', '-qm', 'start');
  const dir = path.join(base, 'clone');
  gitIn(base, 'clone', '-q', '-c', 'core.autocrlf=true', src, dir);
  assert.match(read(path.join(dir, 'a.txt')), /\r\n/);
  assert.match(repairLineEndings(dir).note, /no committed \.gitattributes/);
  put(path.join(src, '.gitattributes'), '* text=auto eol=lf\n');
  gitIn(src, 'add', '-A');
  gitIn(src, 'commit', '-qm', 'attrs');
  gitIn(dir, 'pull', '-q');
  put(path.join(dir, 'new.txt'), 'untracked\n');
  assert.match(repairLineEndings(dir).note, /the tree has changes/);
  fs.rmSync(path.join(dir, 'new.txt'));
  assert.equal(repairLineEndings(dir).status, 'repaired');
  assert.equal(read(path.join(dir, 'a.txt')), 'one\ntwo\n');
  assert.equal(read(path.join(dir, 'b b.txt')), 'x\n');
  assert.equal(gitIn(dir, 'status', '--porcelain'), '');
  assert.equal(repairLineEndings(dir).status, 'unchanged');
});

test('slug and memoryDir', () => {
  assert.equal(slug('/Users/a/b c'), '-Users-a-b-c');
  assert.equal(slug('E:\\x\\y'), 'E--x-y'); // the form the live Windows check confirms
  assert.equal(slug(`/${'a'.repeat(200)}`), null);
  const prof = profile(tmp());
  assert.equal(memoryDir(prof, `/${'a'.repeat(200)}`, { env: NO_ENV }).dir, null);
  const env = { CLAUDE_CONFIG_DIR: prof.claudeDir, CLAUDE_CODE_PROJECT_DIR_NAME: 'work' };
  assert.equal(memoryDir(prof, '/x/y', { env }).dir, path.join(prof.claudeDir, 'projects', 'work', 'memory'));
  assert.equal(memoryDir(prof, '/x/y', { env: { CLAUDE_CODE_PROJECT_DIR_NAME: 'work' } }).via, 'computed');
  put(path.join(prof.claudeDir, 'settings.json'), JSON.stringify({ autoMemoryDirectory: '~/notes/mem' }));
  assert.equal(memoryDir(prof, '/x/y', { env: NO_ENV }).dir, path.join(prof.home, 'notes', 'mem'));
  put(path.join(prof.claudeDir, 'settings.json'), JSON.stringify({ autoMemoryDirectory: 'relative/not/allowed' }));
  assert.equal(memoryDir(prof, '/x/y', { env: NO_ENV }).via, 'computed');
});

test('memoryDir finds a folder Claude Code named differently from its transcript', () => {
  const prof = profile(tmp());
  const root = path.join(tmp(), `${'d'.repeat(210)}`);
  put(path.join(prof.claudeDir, 'projects', 'odd-name', 'abc.jsonl'), `${JSON.stringify({ type: 'user', cwd: root })}\n`);
  const found = memoryDir(prof, root, { env: NO_ENV });
  assert.equal(found.dir, path.join(prof.claudeDir, 'projects', 'odd-name', 'memory'));
  assert.equal(found.via, 'scan');
});

test('every kitPaths key is in exactly one move class', () => {
  const all = [...CLASSES.carry, ...CLASSES.rebuild, ...CLASSES.skip];
  assert.equal(new Set(all).size, all.length);
  for (const k of Object.keys(MANIFEST.kitPaths)) assert.equal(all.filter((c) => c === k).length, 1, k);
  assert.equal(Object.keys(MANIFEST.kitPaths).length, all.length);
});

test('filterPermissions: token-like rules are dropped, long plain paths are not', () => {
  const r = filterPermissions({
    allow: [
      'Bash(aws s3 ls --secret wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY)',
      'Bash(export T=sk-abc123)',
      'Read(/usr/local/lib/node_modules/some-package/dist/**)',
      'Read(/Users/someone/Documents/Projects/app/**)',
      'Read(~/.config/tool/**)',
    ],
    deny: [42, ''],
    env: ['ignored'],
  }, { root: '/Users/someone/Documents/Projects/app', home: '/Users/someone' });
  assert.equal(r.secret, 2);
  assert.deepEqual(r.keep, { allow: ['Read(/usr/local/lib/node_modules/some-package/dist/**)', 'Read(~/.config/tool/**)'], deny: [], ask: [] });
  assert.deepEqual(r.left, ['Read(/Users/someone/Documents/Projects/app/**)']);
});
