import fs from 'node:fs';
import path from 'node:path';
import { hash, readIfExists, readJson, writeJson } from './files.js';
import { kitRoot } from './paths.js';
import { unmergeSettings } from './settings.js';
import { OPTIONS, PLUGIN, applyKit, claude, clearSaved, configureGuard, loadSaved, saveSaved, syncTools, target } from './install.js';
import { MACHINE_HEADER, MACHINE_RULE } from './machine.js';
import { PROJECT_FILE, hideCompanions } from './scaffold.js';
import { COMPANIONS, THIRD_PARTY, TOOLS, defaultRun, installCompanions, installTool, installedRefs, removeTool } from './third-party.js';

const lastLine = (out) => out.split('\n').filter(Boolean).pop() ?? '';
const row = (what, r, ok, note = '') => ({ what, status: r.ok ? ok : 'FAILED', note: r.ok ? note : lastLine(r.out) });

// The scopes with saved choices: user always, project when `dir` has an `init` record.
const savedTargets = (prof, dir) => [target('user', prof, dir), target('project', prof, dir)].filter((t) => loadSaved(t));

export function update({ prof, dir, force, run = defaultRun }) {
  const results = [];
  const targets = savedTargets(prof, dir);
  const project = readJson(path.join(dir, PROJECT_FILE), {});
  if (!targets.length && !project.companions?.length) throw new Error('Nothing saved to update; run `npx pantoo-ai init` first.');
  if (targets.length) {
    const mp = claude(targets[0], run, ['plugin', 'marketplace', 'update', 'pantoo-ai']);
    results.push(row('marketplace pantoo-ai', mp, 'updated'));
  }
  for (const t of targets) {
    const label = targets.length > 1 ? ` (${t.scope})` : '';
    const saved = loadSaved(t);
    const up = claude(t, run, ['plugin', 'update', PLUGIN, '--scope', t.scope]);
    results.push(row(`plugin ${PLUGIN}${label}`, up, 'updated'));
    results.push(...applyKit(t, saved, { options: saved.options ?? [], mp: saved.marketplace, force }));
    saveSaved(t, saved);
    if (saved.guard) results.push(configureGuard(t, run, saved.guard));
    const tools = syncTools(t, saved, run);
    results.push(...(tools.length ? tools : [{ what: `design tools${label}`, status: 'up to date' }]));
  }
  const companions = project.companions ?? [];
  if (companions.length) {
    const refs = installedRefs(dir);
    const pin = TOOLS['ui-ux-pro-max'].sha;
    const stale = companions.filter((n) => refs[n] !== pin || !fs.existsSync(path.join(dir, '.claude', 'skills', n)));
    results.push(...(stale.length ? installCompanions(stale, { dir, prof, run }) : [{ what: 'companions', status: 'up to date' }]));
  }
  return results;
}

export function remove({ prof, scope = 'user', dir, thirdParty, run = defaultRun }) {
  const t = target(scope, prof, dir);
  const saved = loadSaved(t);
  if (!saved) throw new Error(`Nothing to remove at ${scope} scope: no saved choices in ${t.file}.`);
  const results = [];
  const un = claude(t, run, ['plugin', 'uninstall', PLUGIN, '--scope', scope]);
  results.push(row(`plugin ${PLUGIN}`, un, 'uninstalled'));
  const mp = claude(t, run, ['plugin', 'marketplace', 'remove', 'pantoo-ai', '--scope', scope]);
  results.push(row('marketplace pantoo-ai', mp, 'removed'));

  for (const [key, recorded] of Object.entries(saved.files ?? {})) {
    const file = path.resolve(t.base ?? '', key);
    const inside = path.relative(t.claudeDir, file);
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) {
      results.push({ what: key, status: 'skipped', note: 'outside the kit\'s folder' });
      continue;
    }
    const current = readIfExists(file);
    if (current === null) continue;
    const mine = hash(current) === recorded;
    if (mine) fs.rmSync(file);
    results.push({ what: path.relative(t.claudeDir, file) || file, status: mine ? 'removed' : 'kept', note: mine ? '' : 'kept, edited by you' });
  }

  if (scope === 'user') {
    const machine = path.join(t.claudeDir, 'rules', MACHINE_RULE);
    if (readIfExists(machine)?.includes(MACHINE_HEADER)) {
      fs.rmSync(machine);
      results.push({ what: 'rule machine.md', status: 'removed' });
    }
  }

  const snippet = readJson(path.join(kitRoot, 'settings', 'settings-snippet.json'), {});
  const owned = { extraKnownMarketplaces: snippet.extraKnownMarketplaces };
  if (scope === 'project') owned.enabledPlugins = snippet.enabledPlugins;
  for (const id of saved.options ?? []) for (const k of OPTIONS[id]?.settings ?? []) owned[k] = snippet[k];
  const un2 = unmergeSettings(path.join(t.claudeDir, 'settings.json'), owned, saved.settingsAdded);
  results.push({
    what: 'settings.json',
    status: un2.removed.length ? `removed: ${un2.removed.join(', ')}` : 'unchanged',
    note: un2.kept.length ? `kept your values for ${un2.kept.join(', ')}` : '',
  });

  if (thirdParty) for (const id of Object.keys(saved.thirdParty ?? {})) results.push(...removeTool(id, { scope, dir, prof, run }));
  else if (Object.keys(saved.thirdParty ?? {}).length) results.push({ what: 'design tools', status: 'kept', note: 'pass --third-party to remove them' });

  clearSaved(t);
  results.push({ what: 'saved choices', status: 'removed', note: t.key ? `${PROJECT_FILE} init` : t.file });
  return results;
}

// Where `add` writes: the project when its saved choices are project scope, else the user.
export function savedScope(dir) {
  return readJson(path.join(dir, PROJECT_FILE), {}).init?.scope === 'project' ? 'project' : 'user';
}

export const addNames = () => [...new Set(['design', ...Object.keys(OPTIONS), ...COMPANIONS])];

// `design` is both the design pack and a companion name; the pack wins unless `companion` is set.
export function add({ name, prof, dir, force, companion, run = defaultRun }) {
  if (!addNames().includes(name)) throw new Error(`Unknown name "${name}". Valid: ${addNames().join(', ')}.`);
  const file = path.join(dir, PROJECT_FILE);
  if (COMPANIONS.includes(name) && (name !== 'design' || companion)) {
    const project = readJson(file, null);
    if (!project) throw new Error(`No ${PROJECT_FILE} in ${dir}; run \`npx pantoo-ai new\` first.`);
    const results = installCompanions([name], { dir, prof, run });
    if (results[0].status === 'FAILED') return results;
    project.companions = [...new Set([...(project.companions ?? []), name])];
    writeJson(file, project);
    if (project.local && hideCompanions(dir, [name])) results.push({ what: '.git/info/exclude', status: 'updated' });
    return results;
  }
  const t = target(savedScope(dir), prof, dir);
  const saved = loadSaved(t);
  if (!saved) throw new Error(`No saved choices at ${t.scope} scope; run \`npx pantoo-ai init\` first.`);
  if (name === 'design') {
    const results = THIRD_PARTY.packs.design.flatMap((id) => installTool(id, { scope: t.scope, dir, prof, run }));
    const fresh = loadSaved(t);
    fresh.packs = [...new Set([...(fresh.packs ?? []), 'design'])];
    saveSaved(t, fresh);
    return results;
  }
  const options = [...new Set([...(saved.options ?? []), name])];
  const results = applyKit(t, saved, { options: [name], mp: undefined, force });
  saved.options = options;
  saveSaved(t, saved);
  return results.filter((r) => !r.what.startsWith('agent '));
}
