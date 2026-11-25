import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { backup, lf, readJson, stamp, writeFile, writeJson } from './files.js';
import { repairLineEndings } from './doctor.js';
import { MANIFEST, PROJECT_FILE, excludeKitPaths, excludeLocal } from './scaffold.js';
import { plain, validSecrets } from './secrets.js';
import { git as gitRaw } from './spawn.js';
import { VERSION } from './self-update.js';

// D31 + M1–M8 (p8-step14-design.md): move a project's private state to a new clone.

// Every kitPaths key is in exactly one class (a test checks it).
export const CLASSES = {
  carry: ['context/', '.pantoo.json', 'CLAUDE.local.md', 'CLAUDE.md', 'AGENTS.md', 'DESIGN.md', 'PRODUCT.md', '.impeccable/'],
  rebuild: ['.claude/', 'skills-lock.json'],
  skip: ['.impeccable-live/', '.taste-skill/'],
};
// Inside a carried folder but not project data: impeccable's installed script, its live sessions,
// and its per-developer overrides (which hold that machine's hook consent).
const NOT_CARRIED = [/^\.impeccable\/bin\//, /^\.impeccable\/live\//, /^\.impeccable\/config\.local\.json$/];
export const CAPS = { files: 200, size: 5 * 1024 * 1024, total: 20 * 1024 * 1024 };
const PERMISSION_LISTS = ['allow', 'deny', 'ask'];
const SECRET_RULE = /bearer\s|ghp_|gho_|github_pat_|sk-[a-z0-9]|xox[abp]-|AKIA[0-9A-Z]{16}/i;
// A long run of token characters. `/` would make every long path one, so a run that holds `/`
// counts only when it looks like base64 (digits, upper and lower case, no `_ - .`), as an AWS key does.
const LONG_RUN = /[A-Za-z0-9+=_-]{32,}/;
const B64_RUN = /[A-Za-z0-9+/=]{32,}/g;
const looksSecret = (rule, paths) => {
  if (SECRET_RULE.test(rule)) return true;
  // This machine's own paths are not tokens; they decide `left` below.
  const rest = paths.reduce((r, p) => r.split(p).join(' '), rule);
  return LONG_RUN.test(rest) || (rest.match(B64_RUN) ?? []).some((run) => /\d/.test(run) && /[a-z]/.test(run) && /[A-Z]/.test(run));
};
const SETTINGS_LOCAL = '.claude/settings.local.json';

export class MoveStop extends Error {}
const stop = (message) => { throw new MoveStop(message); };

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const posix = (p) => p.split(path.sep).join('/');
const isCarried = (rel) => CLASSES.carry.some((c) => (c.endsWith('/') ? rel.startsWith(c) : rel === c)) && !NOT_CARRIED.some((r) => r.test(rel));
const samePath = (a, b) => (process.platform === 'win32' || process.platform === 'darwin' ? a.toLowerCase() === b.toLowerCase() : a === b);

function within(base, abs) {
  const rel = path.relative(base, abs);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// realpath of the nearest folder that exists, with the rest appended.
function realish(p) {
  let head = path.resolve(p);
  const tail = [];
  while (!fs.existsSync(head)) {
    tail.unshift(path.basename(head));
    const up = path.dirname(head);
    if (up === head) break;
    head = up;
  }
  return path.join(fs.realpathSync(head), ...tail);
}

const makeGit = (prof) => (dir, args, opts = {}) => gitRaw(dir, args, { cwd: prof.home, ...opts });

// Claude Code's project folder name: every character outside [A-Za-z0-9] becomes `-`. Over 200
// characters it is cut and hashed in a way the docs don't give, so null.
export function slug(root) {
  const s = root.replace(/[^A-Za-z0-9]/g, '-');
  return s.length <= 200 ? s : null;
}

// The real hostname behind an ssh Host alias (`github.com-work` → `github.com`), from `ssh -G`,
// which reads ~/.ssh/config and never connects. No ssh, or an odd name: the name as given.
export function sshHostname(host, { config } = {}) {
  if (!/^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(host)) return host;
  const r = spawnSync('ssh', [...(config ? ['-F', config] : []), '-G', host], { encoding: 'utf8', timeout: 5000 });
  const line = r.status === 0 && r.stdout.split(/\r?\n/).find((l) => l.startsWith('hostname '));
  return line ? line.slice('hostname '.length).trim() : host;
}

// host/owner/repo: no scheme, no user info, no .git, lower case. ssh and https agree, and an ssh
// Host alias counts as the host it points to.
export function normalRemote(url, { resolveHost = sshHostname } = {}) {
  if (typeof url !== 'string' || !url.trim()) return null;
  const u = url.trim();
  let out;
  const scp = u.match(/^(?:[^@/:]+@)?([^/:]+):(?!\/)(.+)$/);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) {
    try {
      const parsed = new URL(u);
      const host = /^(git\+)?ssh:$/i.test(parsed.protocol) ? resolveHost(parsed.hostname) : parsed.hostname;
      out = parsed.protocol === 'file:' ? decodeURIComponent(parsed.pathname) : `${host}${parsed.pathname}`;
    } catch {
      return null;
    }
  } else if (scp && !/^[A-Za-z]$/.test(scp[1])) {
    out = `${resolveHost(scp[1])}/${scp[2]}`;
  } else {
    out = path.resolve(u); // a local path, as in a bare repo used as the remote
  }
  return out.replace(/\\/g, '/').replace(/\/+$/, '').replace(/\.git$/i, '').toLowerCase();
}

// The repo, its branch, its remote (the branch's upstream remote, else origin) and HEAD.
function gitState(g, dir) {
  const top = g(dir, ['rev-parse', '--show-toplevel']);
  if (!top.ok) return null;
  const root = path.resolve(top.out.trim());
  const branchRef = g(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const branch = branchRef.ok ? branchRef.out.trim() : null;
  const remoteName = (branch && g(root, ['config', '--get', `branch.${branch}.remote`]).out.trim()) || 'origin';
  const url = g(root, ['remote', 'get-url', '--', remoteName]);
  const head = g(root, ['rev-parse', 'HEAD']).out.trim() || null;
  return { root, branch, remoteName, remote: url.ok ? normalRemote(url.out.trim()) : null, head };
}

const settingsAt = (file) => {
  try { return readJson(file, {}); } catch { return {}; }
};

function memoryFromSetting(value, home) {
  if (typeof value !== 'string' || !value) return null;
  if (value.startsWith('~/')) return path.resolve(home, value.slice(2));
  return path.isAbsolute(value) ? path.resolve(value) : null; // the docs allow only absolute or ~/
}

// The folder under projects/ whose transcript started in `root`. Reads at most 64 KB of a few files each.
function scanProjects(claudeDir, root) {
  const base = path.join(claudeDir, 'projects');
  let names = [];
  try { names = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return null; }
  for (const name of names) {
    let logs = [];
    try { logs = fs.readdirSync(path.join(base, name)).filter((f) => f.endsWith('.jsonl')).slice(0, 20); } catch { continue; }
    for (const log of logs) {
      let text = '';
      try {
        const fd = fs.openSync(path.join(base, name, log), 'r');
        const buf = Buffer.alloc(64 * 1024);
        text = buf.subarray(0, fs.readSync(fd, buf, 0, buf.length, 0)).toString('utf8');
        fs.closeSync(fd);
      } catch { continue; }
      for (const line of text.split('\n')) {
        let cwd;
        try { cwd = JSON.parse(line).cwd; } catch { continue; }
        if (typeof cwd !== 'string') continue;
        if (samePath(path.resolve(cwd), root)) return name;
        break;
      }
    }
  }
  return null;
}

// M7: where Claude Code keeps this project's memory on this machine.
// Returns { dir, via, shared, exists } or { dir: null, via, note }.
export function memoryDir(prof, root, { env = process.env } = {}) {
  // Claude Code's precedence: local over project over user.
  const sources = [
    ['local', path.join(root, SETTINGS_LOCAL)],
    ['project', path.join(root, '.claude', 'settings.json')],
    ['user', path.join(prof.claudeDir, 'settings.json')],
  ];
  for (const [scope, file] of sources) {
    const dir = memoryFromSetting(settingsAt(file).autoMemoryDirectory, prof.home);
    if (dir) return { dir, via: `autoMemoryDirectory (${scope})`, shared: scope === 'project', exists: fs.existsSync(dir) };
  }
  if (env.CLAUDE_CONFIG_DIR && env.CLAUDE_CODE_PROJECT_DIR_NAME && /^[\w.-]+$/.test(env.CLAUDE_CODE_PROJECT_DIR_NAME)) {
    const dir = path.join(prof.claudeDir, 'projects', env.CLAUDE_CODE_PROJECT_DIR_NAME, 'memory');
    return { dir, via: 'CLAUDE_CODE_PROJECT_DIR_NAME', shared: false, exists: fs.existsSync(dir) };
  }
  const name = slug(root);
  const computed = name && path.join(prof.claudeDir, 'projects', name, 'memory');
  if (computed && fs.existsSync(computed)) return { dir: computed, via: 'computed', shared: false, exists: true };
  const found = scanProjects(prof.claudeDir, root);
  if (found) {
    const dir = path.join(prof.claudeDir, 'projects', found, 'memory');
    const note = name && found !== name ? 'Claude Code names this folder differently from the kit; report it' : '';
    return { dir, via: 'scan', shared: false, exists: fs.existsSync(dir), note };
  }
  if (computed) return { dir: computed, via: 'computed', shared: false, exists: false };
  return { dir: null, via: 'none', note: 'the path is over 200 characters; open Claude Code once in this project, then run import again' };
}

// M2: only allow/deny/ask, minus rules that may hold a secret or name this machine's paths.
export function filterPermissions(permissions, { root, home }) {
  const keep = { allow: [], deny: [], ask: [] };
  const left = [];
  let secret = 0;
  const local = [root, home].filter(Boolean).flatMap((p) => [p, p.replace(/\\/g, '/')]);
  for (const list of PERMISSION_LISTS) {
    for (const rule of Array.isArray(permissions?.[list]) ? permissions[list] : []) {
      if (typeof rule !== 'string' || !rule) continue;
      if (looksSecret(rule, local)) secret++;
      else if (local.some((p) => rule.toLowerCase().includes(p.toLowerCase()))) left.push(rule);
      else if (!keep[list].includes(rule)) keep[list].push(rule);
    }
  }
  return { keep, left, secret };
}

const count = (keep) => PERMISSION_LISTS.reduce((n, l) => n + keep[l].length, 0);

function checkCaps(entries) {
  if (entries.length > CAPS.files) stop(`Too many files to carry: ${entries.length}, the limit is ${CAPS.files}.`);
  const big = entries.find((e) => e.size > CAPS.size);
  if (big) stop(`${big.label} is ${(big.size / 1048576).toFixed(1)} MB, over the ${CAPS.size / 1048576} MB limit for one file.`);
  const total = entries.reduce((n, e) => n + e.size, 0);
  if (total > CAPS.total) stop(`The files add up to ${(total / 1048576).toFixed(1)} MB, over the ${CAPS.total / 1048576} MB limit.`);
}

// M1: the kit files git ignores here. Symlinks never travel.
export function carried(g, root) {
  const out = g(root, ['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--', ...CLASSES.carry]);
  return out.out.split('\0').filter(Boolean).filter((rel) => isCarried(rel)).flatMap((rel) => {
    const st = fs.lstatSync(path.join(root, rel), { throwIfNoEntry: false });
    return st?.isFile() ? [{ rel, size: st.size, mtime: st.mtime }] : [];
  });
}

function memoryFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => /^[\w.-]+\.md$/.test(n)).flatMap((name) => {
    const st = fs.lstatSync(path.join(dir, name));
    return st.isFile() ? [{ name, size: st.size, mtime: st.mtime }] : [];
  });
}

function localMcp(prof, root) {
  try {
    const projects = readJson(path.join(prof.home, '.claude.json'), {}).projects ?? {};
    const entry = Object.entries(projects).find(([k]) => samePath(path.resolve(k), root))?.[1];
    return Object.keys(entry?.mcpServers ?? {});
  } catch {
    return []; // an unreadable ~/.claude.json only hides them
  }
}

export function exportMove({ prof, dir, to, env = process.env, now = new Date() }) {
  const g = makeGit(prof);
  const state = gitState(g, dir);
  if (!state) stop(`${dir} is not a git repo; move works on a clone.`);
  const { root } = state;
  if (!state.branch) stop('HEAD is detached; switch to a branch, push it, then export.');
  if (!state.remote) stop(`No remote "${state.remoteName}"; push the project to a remote first.`);
  const on = g(root, ['for-each-ref', '--contains', 'HEAD', '--format=%(refname)', `refs/remotes/${state.remoteName}`]);
  if (!on.out.trim()) stop(`HEAD isn't on ${state.remoteName} (as of the last fetch); push first, then export.`);

  const lines = [];
  const changed = g(root, ['status', '--porcelain']).out.split('\n').filter(Boolean);
  if (changed.length) {
    lines.push(`! ${changed.length} uncommitted change(s) stay on this machine; only ignored kit files travel:`);
    for (const c of changed.slice(0, 20)) lines.push(`    ${c}`);
  }

  const project = readJson(path.join(root, PROJECT_FILE), null);
  const name = (project?.name ? String(project.name) : path.basename(root)).replace(/[^\w.-]+/g, '-').slice(0, 60) || 'project';
  const target = path.resolve(to ?? path.join(prof.home, 'pantoo-move', `${name}-${stamp()}`));
  if (within(fs.realpathSync(root), realish(target))) stop(`--to ${target} is inside the repo; pick a folder outside it.`);
  if (fs.existsSync(target) && (!fs.statSync(target).isDirectory() || fs.readdirSync(target).length)) stop(`${target} exists and isn't an empty folder.`);

  const files = carried(g, root);
  const mem = memoryDir(prof, root, { env });
  const notes = mem.shared ? [] : memoryFiles(mem.dir);
  checkCaps([...files.map((f) => ({ ...f, label: f.rel })), ...notes.map((m) => ({ ...m, label: `memory/${m.name}` }))]);

  const settings = settingsAt(path.join(root, SETTINGS_LOCAL));
  const perms = filterPermissions(settings.permissions, { root, home: prof.home });
  const { secrets } = validSecrets(project, { root, home: prof.home });
  const mcp = localMcp(prof, root);

  const manifest = {
    pantooMove: 1,
    createdAt: now.toISOString(),
    kit: VERSION,
    from: { os: { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[process.platform] ?? process.platform, node: process.versions.node, root },
    project: project?.layout ? { name: String(project.name ?? ''), layout: Number(project.layout), local: Boolean(project.local) } : null,
    git: { remote: state.remote, branch: state.branch, head: state.head },
    files: [],
    memory: [],
    permissions: null,
    secrets: secrets.map((s) => ({ name: s.name, ...(s.env ? { env: s.env } : {}), ...(s.files.length ? { file: s.files.map((f) => f.written) } : {}) })),
    mcpLocal: mcp,
  };
  fs.mkdirSync(target, { recursive: true });
  for (const f of files) {
    const buf = fs.readFileSync(path.join(root, f.rel));
    writeFile(path.join(target, 'files', ...f.rel.split('/')), buf);
    manifest.files.push({ path: f.rel, sha256: sha256(buf), modified: f.mtime.toISOString() });
  }
  for (const m of notes) {
    const buf = fs.readFileSync(path.join(mem.dir, m.name));
    writeFile(path.join(target, 'memory', m.name), buf);
    manifest.memory.push({ name: m.name, sha256: sha256(buf), modified: m.mtime.toISOString() });
  }
  if (count(perms.keep) || perms.left.length) {
    const text = `${JSON.stringify(perms.keep, null, 2)}\n`;
    fs.writeFileSync(path.join(target, 'permissions.json'), text);
    manifest.permissions = { file: 'permissions.json', sha256: sha256(Buffer.from(text)), left: perms.left };
  }
  writeJson(path.join(target, 'move.json'), manifest);

  lines.push(`✓ ${files.length} file(s): ${files.map((f) => f.rel).join(', ') || 'none'}`);
  if (mem.shared) lines.push(`✓ memory is in ${mem.dir}, shared by the project's autoMemoryDirectory; not copied`);
  else lines.push(notes.length ? `✓ ${notes.length} memory note(s) from ${mem.dir}` : '✓ no project memory on this machine');
  if (mem.note) lines.push(`! ${mem.note}`);
  lines.push(`✓ ${count(perms.keep)} permission rule(s)${perms.left.length + perms.secret ? ` (${perms.left.length + perms.secret} left out: ${perms.left.length} name this machine's paths, ${perms.secret} may hold a secret)` : ''}`);
  if (secrets.length) lines.push(`✓ secrets to set up on the new machine: ${secrets.map((s) => s.name).join(', ')}`);
  if (mcp.length) lines.push(`✓ local MCP servers to add again: ${mcp.join(', ')}`);
  lines.push('', `Wrote ${target}`, 'This folder holds your private notes. Move it yourself (Drive, USB) and delete it after the import.');
  return { to: target, manifest, lines };
}

// --- import ---

const isString = (v) => typeof v === 'string';
const BRANCH = /^(?!-)[\w./-]{1,200}$/;
const HEAD = /^[0-9a-f]{40}([0-9a-f]{24})?$/;
const HEX = /^[0-9a-f]{64}$/;
const MEMORY_NAME = /^[\w.-]+\.md$/;

export function safeRel(rel) {
  if (!isString(rel) || !rel || rel.includes('\0') || rel.includes('\\') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) return false;
  const parts = rel.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..' || p.toLowerCase() === '.git')) return false;
  return isCarried(rel);
}

// The folder came over Drive or a USB stick: every field is checked before anything is written.
function verified(folder, real, rel) {
  const file = path.join(folder, ...rel.split('/'));
  const st = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!st) stop(`${rel} is missing: the folder is incomplete; wait for Drive to finish syncing, then run import again.`);
  if (!st.isFile()) stop(`${rel} in the folder isn't a plain file (a symlink?); export again.`);
  if (!within(real, fs.realpathSync(file))) stop(`${rel} resolves outside the folder; export again.`);
  return { file, size: st.size };
}

export function readMoveFolder(folder) {
  const dir = path.resolve(folder);
  if (!fs.existsSync(path.join(dir, 'move.json'))) stop(`No move.json in ${dir}; give the folder \`move export\` wrote.`);
  const real = fs.realpathSync(dir);
  if (fs.lstatSync(path.join(dir, 'move.json')).isSymbolicLink()) stop('move.json is a symlink; export again.');
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(dir, 'move.json'), 'utf8').replace(/^﻿/, '')); } catch { stop('move.json is not valid JSON: the folder is incomplete; wait for Drive to finish syncing.'); }
  const bad = (what) => stop(`move.json: ${what}; export again.`);
  if (m?.pantooMove !== 1) bad('not a version 1 move folder');
  if (!m.git || !isString(m.git.remote) || !isString(m.git.branch) || !BRANCH.test(m.git.branch) || !isString(m.git.head) || !HEAD.test(m.git.head)) bad('git must hold a remote, a branch and a HEAD');
  if (m.project !== null && (typeof m.project !== 'object' || typeof m.project.local !== 'boolean')) bad('project must be null or hold local');
  for (const k of ['files', 'memory', 'secrets', 'mcpLocal']) if (!Array.isArray(m[k])) bad(`${k} must be a list`);
  const entries = [];
  const check = (sub, sha) => {
    const { file, size } = verified(dir, real, sub);
    const buf = fs.readFileSync(file);
    if (sha256(buf) !== sha) stop(`${sub} doesn't match its hash: the folder is incomplete; wait for Drive to finish syncing, then run import again.`);
    entries.push({ size, label: sub });
    return buf;
  };
  const files = m.files.map((f) => {
    if (!safeRel(f?.path)) bad(`files has a path that isn't a kit path inside the project: ${plain(f?.path, 80)}`);
    if (!isString(f.sha256) || !HEX.test(f.sha256)) bad(`${f.path} has no sha256`);
    return { path: f.path, buf: check(`files/${f.path}`, f.sha256) };
  });
  const memory = m.memory.map((f) => {
    if (!isString(f?.name) || !MEMORY_NAME.test(f.name)) bad(`memory has a bad name: ${plain(f?.name, 80)}`);
    if (!isString(f.sha256) || !HEX.test(f.sha256)) bad(`memory ${f.name} has no sha256`);
    return { name: f.name, buf: check(`memory/${f.name}`, f.sha256) };
  });
  checkCaps(entries);
  let permissions = null;
  if (m.permissions !== null && m.permissions !== undefined) {
    const p = m.permissions;
    if (p.file !== 'permissions.json' || !isString(p.sha256) || !HEX.test(p.sha256)) bad('permissions must name permissions.json and its sha256');
    let parsed;
    try { parsed = JSON.parse(check('permissions.json', p.sha256).toString('utf8')); } catch { bad('permissions.json is not valid JSON'); }
    // Filtered again here: the folder may not come from this kit's export.
    const { keep } = filterPermissions(parsed, { root: '', home: '' });
    permissions = { keep, left: Array.isArray(p.left) ? p.left.filter(isString).map((r) => plain(r, 300)) : [] };
  }
  const secrets = m.secrets.filter((s) => isString(s?.name)).map((s) => ({ name: plain(s.name, 64), env: isString(s.env) ? plain(s.env, 64) : null }));
  const mcpLocal = m.mcpLocal.filter((n) => isString(n) && /^[\w.@:-]{1,100}$/.test(n));
  return { folder: dir, git: m.git, project: m.project, from: m.from, files, memory, permissions, secrets, mcpLocal };
}

// A write target inside `base`: no folder on the way is a symlink out, and the file isn't one.
function safeTarget(base, abs) {
  const realBase = fs.realpathSync(base);
  if (!within(realBase, realish(path.dirname(abs)))) return 'its folder resolves outside';
  const st = fs.lstatSync(abs, { throwIfNoEntry: false });
  if (st && !st.isFile()) return 'it is a symlink or a folder here';
  return null;
}

// Puts one carried file in place: written, left alone, replaced (with a backup) or kept as yours.
async function place({ abs, buf, token, take, ask, base }) {
  const unsafe = safeTarget(base, abs);
  if (unsafe) return { status: 'skipped', note: unsafe };
  if (!fs.existsSync(abs)) {
    writeFile(abs, buf);
    return { status: 'added' };
  }
  if (lf(fs.readFileSync(abs, 'utf8')) === lf(buf.toString('utf8'))) return { status: 'same' };
  const yes = take.has('all') || take.has(token) || (ask ? await ask.confirm(`${token} differs from the copy here. Replace yours (a backup is kept)?`) : false);
  if (!yes) return { status: 'kept', note: `differs; \`--take ${token}\` replaces yours` };
  const bak = backup(abs);
  writeFile(abs, buf);
  return { status: 'replaced', note: `backup ${path.basename(bak)}` };
}

const parseAllow = (allow, total) => {
  if (!allow) return new Set();
  if (allow === 'all') return new Set(Array.from({ length: total }, (_, i) => i + 1));
  const nums = String(allow).split(',').map((s) => s.trim()).filter(Boolean).map(Number);
  const badNum = nums.find((n) => !Number.isInteger(n) || n < 1 || n > total);
  if (badNum !== undefined) throw new Error(`--allow takes rule numbers from 1 to ${total}, or all.`);
  return new Set(nums);
};

export async function importMove({ prof, dir, folder, allow, take = [], ask = null, env = process.env }) {
  const g = makeGit(prof);
  const m = readMoveFolder(folder);

  const state = gitState(g, dir);
  if (!state) stop(`${dir} is not a git repo; clone the project first, then import in the clone.`);
  const { root } = state;
  if (state.remote !== m.git.remote) stop(`This clone's remote (${state.remote ?? 'none'}) isn't the exported one (${plain(m.git.remote, 200)}).`);
  if (state.branch !== m.git.branch) stop(`This clone is on ${state.branch ?? 'a detached HEAD'}; run \`git switch ${m.git.branch}\`, then import again.`);
  const known = g(root, ['cat-file', '-e', `${m.git.head}^{commit}`]).ok;
  if (!known || !g(root, ['merge-base', '--is-ancestor', m.git.head, 'HEAD']).ok) {
    stop(`This clone doesn't have the exported commit ${m.git.head.slice(0, 12)}; run \`git fetch\`, then \`git switch ${m.git.branch}\` (and pull), then import again.`);
  }

  const lines = [];
  const pending = [];
  if (state.head !== m.git.head) lines.push(`! This clone is ahead of the exported commit ${m.git.head.slice(0, 12)}; the notes are right, only older.`);

  const fix = repairLineEndings(root, { cwd: prof.home });
  lines.push(`${fix.status === 'repaired' || fix.status === 'unchanged' ? '✓' : '!'} line endings: ${fix.status}${fix.note ? `  (${fix.note})` : ''}`);

  const carriedProject = m.files.find((f) => f.path === PROJECT_FILE);
  let local = Boolean(m.project?.local);
  if (carriedProject) {
    try { local = local || JSON.parse(carriedProject.buf.toString('utf8')).local === true; } catch { /* the hash matched; a bad file is only not read */ }
  }
  if (local) lines.push(`✓ .git/info/exclude: ${excludeKitPaths(root) ? 'kit paths hidden' : 'already hides the kit paths'}`);

  const takes = new Set(take);
  for (const f of m.files) {
    const abs = path.join(root, ...f.path.split('/'));
    const r = await place({ abs, buf: f.buf, token: f.path, take: takes, ask, base: root });
    if (r.status === 'kept') pending.push(`--take ${f.path}`);
    if (['added', 'replaced'].includes(r.status) && !g(root, ['check-ignore', '-q', '--', f.path]).ok && !g(root, ['ls-files', '--', f.path]).out.trim()) {
      excludeLocal(root, [`/${f.path}`]);
      r.note = `${r.note ? `${r.note}; ` : ''}hidden in .git/info/exclude, as it was ignored on the old machine`;
    }
    lines.push(`${r.status === 'kept' || r.status === 'skipped' ? '!' : '✓'} ${f.path}: ${r.status}${r.note ? `  (${r.note})` : ''}`);
  }

  if (m.memory.length) {
    const mem = memoryDir(prof, root, { env });
    if (mem.shared) lines.push(`✓ memory: skipped; the project's autoMemoryDirectory shares it (${mem.dir})`);
    else if (!mem.dir) lines.push(`! memory: skipped; ${mem.note}`);
    else {
      if (mem.note) lines.push(`! ${mem.note}`);
      fs.mkdirSync(mem.dir, { recursive: true });
      const bare = new Set(m.files.map((f) => f.path));
      for (const note of m.memory) {
        const abs = path.join(mem.dir, note.name);
        const token = `memory/${note.name}`;
        // `--take <name>` works too, unless a carried file has that same path.
        const memTake = new Set([...takes].filter((t) => t === 'all' || t === token || (t === note.name && !bare.has(t))).map((t) => (t === 'all' ? t : token)));
        let r;
        if (note.name === 'MEMORY.md') r = unionIndex(abs, note.buf, mem.dir);
        else r = await place({ abs, buf: note.buf, token, take: memTake, ask, base: mem.dir });
        if (r.status === 'kept') pending.push(`--take ${token}`);
        lines.push(`${r.status === 'kept' || r.status === 'skipped' ? '!' : '✓'} ${token}: ${r.status}${r.note ? `  (${r.note})` : ''}`);
      }
      lines.push(`  memory folder: ${mem.dir}`);
    }
  }

  if (m.permissions) lines.push(...(await grant(g, root, m.permissions, { allow, ask, pending })));

  if (m.secrets.length) lines.push(`Set these up on this machine: ${m.secrets.map((s) => (s.env ? `${s.name} (env ${s.env})` : s.name)).join(', ')}`);
  if (m.mcpLocal.length) lines.push(`Add these local MCP servers again (\`claude mcp add\`): ${m.mcpLocal.join(', ')}`);
  if (pending.length) {
    lines.push('', 'Waiting on your answer; rerun the same import with:');
    for (const p of pending) lines.push(`    ${p}`);
  }
  return { root, lines, pending };
}

// MEMORY.md is an index: the local lines first, then the incoming lines it lacks, in order.
function unionIndex(abs, buf, base) {
  const unsafe = safeTarget(base, abs);
  if (unsafe) return { status: 'skipped', note: unsafe };
  const incoming = lf(buf.toString('utf8'));
  if (!fs.existsSync(abs)) {
    writeFile(abs, incoming);
    return { status: 'added' };
  }
  const current = lf(fs.readFileSync(abs, 'utf8'));
  const have = new Set(current.split('\n'));
  const extra = incoming.split('\n').filter((l) => l.trim() && !have.has(l));
  if (!extra.length) return { status: 'same' };
  backup(abs);
  writeFile(abs, `${current.replace(/\n*$/, '\n')}${extra.join('\n')}\n`);
  return { status: 'merged', note: `${extra.length} line(s) added` };
}

// M3: a permission is added only after a yes: a TTY multiselect, or --allow on a rerun. Never --yes.
async function grant(g, root, permissions, { allow, ask, pending }) {
  const lines = [];
  const rules = PERMISSION_LISTS.flatMap((list) => permissions.keep[list].map((rule) => ({ list, rule })));
  const file = path.join(root, ...SETTINGS_LOCAL.split('/'));
  const settings = settingsAt(file);
  const has = (r) => Array.isArray(settings.permissions?.[r.list]) && settings.permissions[r.list].includes(r.rule);
  const numbered = rules.map((r, i) => ({ ...r, n: i + 1, there: has(r) }));
  const open = numbered.filter((r) => !r.there);
  let chosen = parseAllow(allow, rules.length);
  if (!allow && ask && open.length) {
    const picked = await ask.multiselect('Permissions from the old machine to add here (none preselected)', open.map((r) => ({ value: r.n, label: `${r.list}  ${r.rule}` })));
    chosen = new Set(picked ?? []);
  }
  const add = open.filter((r) => chosen.has(r.n));
  if (add.length) {
    const unsafe = safeTarget(root, file);
    if (unsafe) {
      lines.push(`! ${SETTINGS_LOCAL}: skipped (${unsafe})`);
    } else {
      if (fs.existsSync(file)) backup(file);
      const next = { ...settings, permissions: { ...settings.permissions } };
      for (const r of add) next.permissions[r.list] = [...(Array.isArray(next.permissions[r.list]) ? next.permissions[r.list] : []), r.rule];
      writeJson(file, next);
      if (!g(root, ['check-ignore', '-q', '--', SETTINGS_LOCAL]).ok) excludeLocal(root, [`/${SETTINGS_LOCAL}`]);
      lines.push(`✓ ${SETTINGS_LOCAL}: ${add.length} rule(s) added`);
    }
  }
  const waiting = open.filter((r) => !chosen.has(r.n));
  if (waiting.length) {
    lines.push('Permissions not added (each needs your yes):');
    for (const r of waiting) lines.push(`    ${r.n}. ${r.list}  ${plain(r.rule, 300)}`);
    pending.push(`--allow <numbers, e.g. ${waiting.slice(0, 2).map((r) => r.n).join(',')}> or --allow all`);
  }
  const already = numbered.filter((r) => r.there).length;
  if (already) lines.push(`✓ ${already} permission rule(s) already here`);
  if (permissions.left.length) {
    lines.push('Re-create by hand (they name the old machine\'s paths):');
    for (const r of permissions.left) lines.push(`    ${r}`);
  }
  return lines;
}
