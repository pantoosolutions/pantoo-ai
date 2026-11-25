import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from './spawn.js';
import { hash, lf, readIfExists, readJson, writeJson } from './files.js';
import { kitRoot } from './paths.js';

export const THIRD_PARTY = readJson(path.join(kitRoot, 'third-party.json'), { skillsCli: '', tools: {}, packs: {} });
export const TOOLS = THIRD_PARTY.tools;
export const COMPANIONS = TOOLS['ui-ux-pro-max']?.companions ?? [];
export const LOCK_FILE = 'skills-lock.json';
const PROJECT_FILE = '.pantoo.json';

// What a tool is pinned to: the npm spec, or the commit sha for skills-CLI tools.
export const pinOf = (id) => (TOOLS[id].via === 'npm' ? TOOLS[id].npm : TOOLS[id].sha);

// Files that appear inside a skill folder by using it; they aren't part of what was installed.
const NOT_SKILL = /^(__pycache__|node_modules|\.DS_Store|Thumbs\.db|desktop\.ini|.*\.pyc)$/;

function walk(root, rel = '') {
  return fs.readdirSync(path.join(root, rel), { withFileTypes: true }).filter((e) => !NOT_SKILL.test(e.name)).flatMap((e) => {
    const next = rel ? `${rel}/${e.name}` : e.name;
    return e.isDirectory() ? walk(root, next) : e.isFile() ? [next] : [];
  });
}

// One hash for a skill folder, the same on every OS: `/` paths in a fixed order, and CRLF read as LF
// in text files. A file with a NUL byte is binary and is hashed as it is.
export function folderHash(dir) {
  const all = crypto.createHash('sha256');
  for (const rel of walk(dir).sort()) {
    const bytes = fs.readFileSync(path.join(dir, rel));
    // latin1 maps every byte to one character, so nothing is lost on the way to `hash`.
    const one = bytes.includes(0) ? crypto.createHash('sha256').update(bytes).digest('hex') : hash(bytes.toString('latin1'));
    all.update(`${rel}\0${one}\n`);
  }
  return all.digest('hex');
}

const skillVersion = (dir) => lf(readIfExists(path.join(dir, 'SKILL.md')) ?? '')
  .match(/^---\n([\s\S]*?)\n---/)?.[1].match(/^version:\s*["']?([\w.+-]+)/m)?.[1] ?? null;

const compareVersions = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const npmVersion = (spec) => spec.slice(spec.lastIndexOf('@') + 1);

// A readable name for a pin: the kit's tag, an earlier kit's tag, or a short sha.
export function pinLabel(id, pin) {
  const tool = TOOLS[id];
  if (tool.via === 'npm') return npmVersion(pin);
  return [tool, ...(tool.previous ?? [])].find((p) => p.sha === pin)?.tag ?? pin.slice(0, 7);
}

// Reads one skill folder: is(pin) says whether it holds that pin, `older` whether it's behind the
// kit's, and `found` which version it is, when that can be told.
// With a `version:` in SKILL.md (impeccable) the versions are compared. Otherwise the folder's hash
// is compared with the pin's, and only a hash an earlier kit pinned counts as older.
function readSkill(id, name, dir) {
  const tool = TOOLS[id];
  if (tool.via === 'npm') {
    const version = skillVersion(dir);
    const want = npmVersion(tool.npm);
    return {
      is: (pin) => version === npmVersion(pin),
      older: version !== null && compareVersions(version, want) < 0,
      found: version,
    };
  }
  const actual = folderHash(dir);
  const earlier = (tool.previous ?? []).find((p) => p.hashes?.[name] === actual);
  return {
    is: (pin) => [tool, ...(tool.previous ?? [])].find((p) => p.sha === pin)?.hashes?.[name] === actual,
    older: Boolean(earlier),
    found: earlier?.tag ?? null,
  };
}

// The tools this machine keeps where they are (D30), as { id: pin of what was installed }.
export const readHolds = (prof) => readJson(prof.configFile, null)?.holds ?? {};
export const heldRow = (what, id, pin) => ({ what, status: 'held', note: `at ${pinLabel(id, pin)}; \`npx pantoo-ai update --release ${id}\` moves it` });

// The pin of what a skill folder holds, or null when it's no version the kit can name.
function installedPin(id, root) {
  const tool = TOOLS[id];
  const name = tool.skills[0];
  const dir = path.join(root, name);
  if (tool.via === 'npm') {
    const version = skillVersion(dir);
    return version && `${tool.npm.slice(0, tool.npm.lastIndexOf('@'))}@${version}`;
  }
  const actual = folderHash(dir);
  return [tool, ...(tool.previous ?? [])].find((p) => p.hashes?.[name] === actual)?.sha ?? null;
}

// Adds and releases holds in the user config; all of them are checked before anything is written.
// The user's copy of a skill is read first, since it wins over a project's.
export function setHolds({ hold = [], release = [] }, { dir, prof }) {
  if (!hold.length && !release.length) return [];
  const unknown = [...hold, ...release].find((id) => !Object.hasOwn(TOOLS, id));
  if (unknown) throw new Error(`Unknown tool "${unknown}". Valid: ${Object.keys(TOOLS).join(', ')}.`);
  if (hold.some((id) => release.includes(id))) throw new Error('A tool can\'t be held and released at once.');
  const config = readJson(prof.configFile, null);
  if (!config) throw new Error(`Holds are saved in ${prof.configFile}, which doesn't exist; run \`npx pantoo-ai init\` first.`);
  const holds = { ...config.holds };
  const results = [];
  for (const id of hold) {
    const root = [skillsRoot('user', { prof }), skillsRoot('project', { dir })].find((r) => fs.existsSync(path.join(r, TOOLS[id].skills[0])));
    if (!root) throw new Error(`Can't hold ${id}: it isn't installed.`);
    const pin = installedPin(id, root);
    if (!pin) throw new Error(`Can't hold ${id}: the skill in ${root} is no version this kit knows (newer, or changed by hand).`);
    holds[id] = pin;
    results.push({ what: `hold ${id}`, status: 'saved', note: `at ${pinLabel(id, pin)}` });
  }
  for (const id of release) {
    results.push({ what: `hold ${id}`, status: Object.hasOwn(holds, id) ? 'released' : 'not held' });
    delete holds[id];
  }
  if (Object.keys(holds).length) config.holds = holds;
  else delete config.holds;
  writeJson(prof.configFile, config);
  return results;
}

// Compares an installed skill with the kit's pin, from the files on disk:
// 'ok', 'older', 'newer' (anything the kit never pinned) or 'held' (D30).
// A hold on a tool must match what's installed. A companion at the kit's pin is ok even on a machine
// that holds ui-ux-pro-max, since companions are committed with the project.
export function skillState(id, { name = TOOLS[id].skills[0], root, hold }) {
  const skill = readSkill(id, name, path.join(root, name));
  const pin = pinOf(id);
  const kit = pinLabel(id, pin);
  const companion = !TOOLS[id].skills.includes(name);
  if (companion && skill.is(pin)) return { state: 'ok', kit };
  if (hold && skill.is(hold)) return { state: 'held', kit, held: pinLabel(id, hold) };
  if (hold) return { state: 'changed', kit, held: pinLabel(id, hold), found: skill.is(pin) ? kit : skill.found };
  if (skill.is(pin)) return { state: 'ok', kit };
  return { state: skill.older ? 'older' : 'newer', kit, found: skill.found };
}

// The doctor row for a state.
export function stateRow({ state, kit, held, found }) {
  if (state === 'ok') return { level: 'ok', note: '' };
  if (state === 'held') return { level: 'ok', note: `held at ${held} (kit pins ${kit})` };
  if (state === 'changed') return { level: 'warn', note: `held at ${held}, but the installed skill ${found ? `is ${found}` : 'differs from it'}` };
  if (state === 'older') return { level: 'warn', note: `older: ${found}, the kit pins ${kit}; run \`npx pantoo-ai update\`` };
  return { level: 'warn', note: found ? `newer than the kit's pin: ${found}, the kit pins ${kit}` : `newer than the kit's pin ${kit}, or changed by hand` };
}

export const skillsRoot = (scope, ctx) => path.join(scope === 'project' ? ctx.dir : ctx.prof.home, '.claude', 'skills');

// Runs a command; `run` is injectable so tests never touch the network.
export function defaultRun(cmd, args, { cwd, env, input } = {}) {
  const r = spawn(cmd, args, { cwd, env, input });
  if (r.error) return { ok: false, out: r.error.code === 'ENOENT' ? `${cmd} not found on PATH` : r.error.message };
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}`.trim() };
}

const lastLine = (out) => out.split('\n').filter(Boolean).pop() ?? '';
const cwdOf = (scope, { dir, prof }) => (scope === 'project' ? dir : prof.home);

function record(scope, { dir, prof }, id, pin) {
  const file = scope === 'project' ? path.join(dir, PROJECT_FILE) : prof.configFile;
  const json = readJson(file, scope === 'project' ? {} : { version: 1, files: {} });
  const holder = scope === 'project' ? (json.init ??= {}) : json;
  holder.thirdParty ??= {};
  if (pin) holder.thirdParty[id] = { pin };
  else delete holder.thirdParty[id];
  writeJson(file, json);
}

const addArgs = (repo, ref, names, global) => [
  '-y', THIRD_PARTY.skillsCli, 'add', `${repo}#${ref}`, ...names.flatMap((n) => ['--skill', n]),
  '-a', 'claude-code', '-y', '--copy', ...(global ? ['-g'] : []),
];
const removeArgs = (names, global) => ['-y', THIRD_PARTY.skillsCli, 'remove', ...names, '-a', 'claude-code', '-y', ...(global ? ['-g'] : [])];

// impeccable's installer takes the skill from impeccable.style's feed, whatever npm version runs it,
// and doesn't check the signature of a local bundle. So the kit fetches the tagged zip, checks it
// against its own sha256 and only then hands it over. Nothing is installed if either step fails.
function withBundle({ url, sha256 }, run, env, install) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-bundle-'));
  try {
    const file = path.join(tmp, 'bundle.zip');
    const got = run('curl', ['-fsSL', '--retry', '2', '--max-time', '600', '--proto', '=https', '--proto-redir', '=https', '-o', file, url], { env });
    if (!got.ok || !fs.existsSync(file)) return { ok: false, out: `bundle download failed: ${lastLine(got.out) || url}` };
    const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (actual !== sha256) return { ok: false, out: `bundle sha256 is ${actual.slice(0, 12)}, expected ${sha256.slice(0, 12)}; not installed` };
    return install({ ...env, IMPECCABLE_BUNDLE_PATH: file });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Installs one design tool at "user" or "project" scope and records its pin.
export function installTool(id, { scope, dir, prof, run = defaultRun }) {
  const tool = TOOLS[id];
  if (!tool) throw new Error(`Unknown tool ${id}.`);
  const user = scope !== 'project';
  // --no-hooks: impeccable's detector hooks would otherwise run in every project; a project that
  // wants them turns them on with `/impeccable hooks on`.
  const args = tool.via === 'npm'
    ? ['-y', tool.npm, 'install', '--providers=claude', `--scope=${user ? 'global' : 'project'}`, '--no-hooks', '--yes', '--force']
    : addArgs(tool.repo, tool.sha, tool.skills, user);
  const npx = (env) => run('npx', args, { cwd: cwdOf(scope, { dir, prof }), env });
  const r = tool.bundle ? withBundle(tool.bundle, run, prof.env, npx) : npx(prof.env);
  if (r.ok) record(scope, { dir, prof }, id, pinOf(id));
  return [{ what: `design tool ${id}`, status: r.ok ? 'installed' : 'FAILED', note: r.ok ? pinOf(id).slice(0, 19) : lastLine(r.out) }];
}

// Installs ui-ux-pro-max companions at project scope; the lock file records their refs.
export function installCompanions(names, { dir, prof, run = defaultRun }) {
  if (!names.length) return [];
  const tool = TOOLS['ui-ux-pro-max'];
  const r = run('npx', addArgs(tool.repo, tool.sha, names, false), { cwd: dir, env: prof.env });
  return names.map((n) => ({ what: `companion ${n}`, status: r.ok ? 'installed' : 'FAILED', note: r.ok ? '' : lastLine(r.out) }));
}

export function removeCompanions(names, { dir, prof, run = defaultRun }) {
  if (!names.length) return [];
  const r = run('npx', removeArgs(names, false), { cwd: dir, env: prof.env });
  return names.map((n) => ({ what: `companion ${n}`, status: r.ok ? 'removed' : 'FAILED', note: r.ok ? '' : lastLine(r.out) }));
}

export function removeTool(id, { scope, dir, prof, run = defaultRun }) {
  const tool = TOOLS[id];
  if (!tool) return [{ what: `design tool ${id}`, status: 'kept', note: 'not in third-party.json' }];
  const base = path.join(scope === 'project' ? dir : prof.home, '.claude');
  const results = [];
  if (tool.via === 'npm') {
    // impeccable has no uninstall command: delete only what it installed, and only what exists.
    const found = [
      ...tool.skills.map((s) => path.join(base, 'skills', s)),
      ...(tool.agents ?? []).map((a) => path.join(base, 'agents', `${a}.md`)),
    ].filter((f) => fs.existsSync(f));
    for (const f of found) fs.rmSync(f, { recursive: true, force: true });
    results.push({ what: `design tool ${id}`, status: found.length ? 'removed' : 'not found' });
  } else {
    const r = run('npx', removeArgs(tool.skills, scope !== 'project'), { cwd: cwdOf(scope, { dir, prof }), env: prof.env });
    results.push({ what: `design tool ${id}`, status: r.ok ? 'removed' : 'FAILED', note: r.ok ? '' : lastLine(r.out) });
    if (!r.ok) return results;
  }
  record(scope, { dir, prof }, id, null);
  return results;
}

// { name: ref } from the project's skills-lock.json. Lock v2 (skills 1.9) records the resolved sha
// as `commit`; its `ref` is only what was asked for, and is missing when nothing was. v1 has `ref`.
export function installedRefs(dir) {
  const lock = readJson(path.join(dir, LOCK_FILE), { skills: {} });
  return Object.fromEntries(Object.entries(lock.skills ?? {}).map(([name, v]) => [name, v.commit ?? v.ref]));
}

// Pack tools whose skill folders are missing at both user and project scope.
export function designMissing({ dir, prof }) {
  return ['impeccable', 'taste'].filter((id) => !TOOLS[id].skills.every((s) => [skillsRoot('user', { prof }), skillsRoot('project', { dir })].some((d) => fs.existsSync(path.join(d, s)))));
}

export const hasSkills = (scope, ctx, id) => TOOLS[id].skills.every((s) => fs.existsSync(path.join(skillsRoot(scope, ctx), s)));
