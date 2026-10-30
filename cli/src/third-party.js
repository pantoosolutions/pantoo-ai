import fs from 'node:fs';
import path from 'node:path';
import { spawn } from './spawn.js';
import { readJson, writeJson } from './files.js';
import { kitRoot } from './paths.js';

export const THIRD_PARTY = readJson(path.join(kitRoot, 'third-party.json'), { skillsCli: '', tools: {}, packs: {} });
export const TOOLS = THIRD_PARTY.tools;
export const COMPANIONS = TOOLS['ui-ux-pro-max']?.companions ?? [];
export const LOCK_FILE = 'skills-lock.json';
const PROJECT_FILE = '.pantoo.json';

// What a tool is pinned to: the npm spec, or the commit sha for skills-CLI tools.
export const pinOf = (id) => (TOOLS[id].via === 'npm' ? TOOLS[id].npm : TOOLS[id].sha);

// Runs a command; `run` is injectable so tests never touch the network.
export function defaultRun(cmd, args, { cwd, env, input } = {}) {
  const r = spawn(cmd, args, { cwd, env, input });
  if (r.error) return { ok: false, out: r.error.code === 'ENOENT' ? `${cmd} not found on PATH` : r.error.message };
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}`.trim() };
}

const lastLine = (out) => out.split('\n').filter(Boolean).pop() ?? '';
const skillsDir = (scope, { dir, prof }) => path.join(scope === 'project' ? dir : prof.home, '.claude', 'skills');
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
  const r = run('npx', args, { cwd: cwdOf(scope, { dir, prof }), env: prof.env });
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

// { name: ref } from the project's skills-lock.json.
export function installedRefs(dir) {
  const lock = readJson(path.join(dir, LOCK_FILE), { skills: {} });
  return Object.fromEntries(Object.entries(lock.skills ?? {}).map(([name, v]) => [name, v.ref]));
}

// Pack tools whose skill folders are missing at both user and project scope.
export function designMissing({ dir, prof }) {
  return ['impeccable', 'taste'].filter((id) => !TOOLS[id].skills.every((s) => [skillsDir('user', { prof }), skillsDir('project', { dir })].some((d) => fs.existsSync(path.join(d, s)))));
}

export const hasSkills = (scope, ctx, id) => TOOLS[id].skills.every((s) => fs.existsSync(path.join(skillsDir(scope, ctx), s)));
