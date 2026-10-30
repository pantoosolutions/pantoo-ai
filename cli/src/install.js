import fs from 'node:fs';
import path from 'node:path';
import { backup, hash, lf, readIfExists, readJson, sameText, writeFile, writeJson } from './files.js';
import { detectMachine } from './machine.js';
import { kitRoot } from './paths.js';
import { PROJECT_FILE } from './scaffold.js';
import { mergeSettings } from './settings.js';
import { THIRD_PARTY, defaultRun, installTool, pinOf } from './third-party.js';

export const GUARDS = ['block', 'warn', 'off'];

export const PLUGIN = 'pantoo@pantoo-ai';
export const DEFAULT_MARKETPLACE = 'pantoosolutions/pantoo-ai';

// Core rules by option id. `settings` lists the snippet keys the option owns.
export const OPTIONS = {
  'model-routing': { label: 'Model routing rule (suggest-only)', rules: ['model-and-token-strategy.md'], settings: ['env', 'modelSettings'] },
  context7: { label: 'Use ctx7 for library docs', rules: ['context7.md'], settings: [] },
  'no-attribution': { label: 'No AI attribution in commits and PRs', rules: ['git-commits.md'], settings: ['attribution'] },
  'web-access': { label: 'Web access: cheapest tool first', rules: ['web-access.md'], settings: [] },
};

export const agentFiles = () => fs.readdirSync(path.join(kitRoot, 'agents-user')).filter((f) => f.endsWith('.md'));

// Where a scope keeps its files and its saved choices. User choices are ~/.pantoo/config.json;
// a project's live under the `init` key of .pantoo.json (committed).
export function target(scope, prof, dir) {
  if (scope === 'project') return { scope, prof, dir, claudeDir: path.join(dir, '.claude'), file: path.join(dir, PROJECT_FILE), key: 'init', base: dir, cwd: dir };
  return { scope: 'user', prof, dir, claudeDir: prof.claudeDir, file: prof.configFile, key: null, base: null, cwd: prof.home };
}

export const loadSaved = (t) => (t.key ? readJson(t.file, {})[t.key] ?? null : readJson(t.file, null));

export function saveSaved(t, saved) {
  if (!t.key) return writeJson(t.file, saved);
  writeJson(t.file, { ...readJson(t.file, {}), [t.key]: saved });
}

export function clearSaved(t) {
  if (!t.key) return fs.rmSync(t.file, { force: true });
  const json = readJson(t.file, {});
  delete json[t.key];
  if (Object.keys(json).length) writeJson(t.file, json);
  else fs.rmSync(t.file, { force: true });
}

// Recorded paths are relative to the project for project scope, so the record travels with the repo.
export const recordKey = (t, dest) => (t.base ? path.relative(t.base, dest).split(path.sep).join('/') : dest);

// Installs one kit-owned file. A file the user changed is kept unless `force`.
function place(src, dest, record, force, key = dest) {
  const text = lf(fs.readFileSync(src, 'utf8'));
  const current = readIfExists(dest);
  if (sameText(current, text)) {
    record[key] = hash(text);
    return 'unchanged';
  }
  if (current !== null && record[key] !== hash(current) && !force) return 'kept';
  const copy = current !== null && record[key] !== hash(current) ? backup(dest) : null;
  writeFile(dest, text);
  record[key] = hash(text);
  return copy ? `replaced (backup ${path.basename(copy)})` : current === null ? 'added' : 'updated';
}

export const claude = (t, run, args, input) => run('claude', args, { cwd: t.cwd, env: t.prof.env, input });
const lastLine = (out) => out.split('\n').filter(Boolean).pop() ?? '';

export function configureGuard(t, run, guard) {
  const r = claude(t, run, ['plugin', 'configure', PLUGIN, '--values-stdin'], JSON.stringify({ commit_guard: guard }));
  if (r.ok) return { what: 'commit guard', status: `set to ${guard}` };
  // Older Claude Code (2.1.177) has no `plugin configure`. The hook's default is block, so only
  // warn and off need a newer version.
  if (/unknown command/i.test(r.out)) {
    return guard === 'block'
      ? { what: 'commit guard', status: 'block (default)', note: 'this Claude Code has no `plugin configure`' }
      : { what: 'commit guard', status: 'FAILED', note: `stays block: \`${guard}\` needs a newer Claude Code (\`claude update\`)` };
  }
  return { what: 'commit guard', status: 'FAILED', note: lastLine(r.out) };
}

// Agents (user scope only), the rule files and merged settings for `options`.
export function applyKit(t, saved, { options, mp, force, machine }) {
  const results = [];
  saved.files ??= {};
  if (t.scope === 'user') {
    for (const f of agentFiles()) {
      const dest = path.join(t.claudeDir, 'agents', f);
      results.push({ what: `agent ${f}`, status: place(path.join(kitRoot, 'agents-user', f), dest, saved.files, force, recordKey(t, dest)) });
    }
  }
  const snippet = readJson(path.join(kitRoot, 'settings', 'settings-snippet.json'), {});
  const settings = {};
  for (const id of options.filter((o) => OPTIONS[o])) {
    for (const f of OPTIONS[id].rules) {
      const dest = path.join(t.claudeDir, 'rules', f);
      results.push({ what: `rule ${f}`, status: place(path.join(kitRoot, 'rules', f), dest, saved.files, force, recordKey(t, dest)) });
    }
    for (const k of OPTIONS[id].settings) settings[k] = snippet[k];
  }
  // The marketplace entry carries autoUpdate (D20). Skipped for a local test marketplace,
  // since the entry would point the same name back at GitHub.
  if (mp === DEFAULT_MARKETPLACE) settings.extraKnownMarketplaces = snippet.extraKnownMarketplaces;
  if (t.scope === 'project') settings.enabledPlugins = snippet.enabledPlugins;
  // The one machine-specific key: where Claude Code finds Git Bash on Windows. User scope only,
  // since a project's settings are shared with machines that keep it elsewhere.
  const gitBash = t.scope === 'user' ? (machine ?? (process.platform === 'win32' ? detectMachine() : null))?.gitBash : null;
  if (gitBash) settings.env = { ...settings.env, CLAUDE_CODE_GIT_BASH_PATH: gitBash };
  const merged = mergeSettings(path.join(t.claudeDir, 'settings.json'), settings);
  if (saved.settingsAdded) saved.settingsAdded = [...new Set([...saved.settingsAdded, ...merged.added])];
  results.push({
    what: 'settings.json',
    status: merged.added.length ? `merged: ${merged.added.join(', ')}` : 'unchanged',
    note: merged.kept.length ? `kept your values for ${merged.kept.join(', ')}` : '',
  });
  return results;
}

// Installs, or re-pins, the design pack tools whose recorded pin is missing or differs.
export function syncTools(t, saved, run, { all = false } = {}) {
  const wanted = saved.packs?.includes('design') ? THIRD_PARTY.packs.design : Object.keys(saved.thirdParty ?? {});
  const results = [];
  for (const id of wanted) {
    if (!all && saved.thirdParty?.[id]?.pin === pinOf(id)) continue;
    results.push(...installTool(id, { scope: t.scope, dir: t.dir, prof: t.prof, run }));
  }
  return results;
}

export function install({ prof, scope = 'user', dir, options, marketplace, force, guard = 'block', packs = ['design'], run = defaultRun }) {
  const t = target(scope, prof, dir);
  // Project scope is shared through commits, which a local-only project never makes.
  if (scope === 'project' && readJson(t.file, {}).local) throw new Error('This project is local only (`new --local`); use `init --scope user`.');
  const results = [];
  const saved = loadSaved(t) ?? { version: 1, files: {}, settingsAdded: [] };

  // A local marketplace goes to `claude` as an absolute path: it rejects a bare `.`.
  const mp = marketplace && fs.existsSync(marketplace) ? path.resolve(marketplace) : marketplace ?? DEFAULT_MARKETPLACE;
  const add = claude(t, run, ['plugin', 'marketplace', 'add', mp, '--scope', scope]);
  const inst = add.ok ? claude(t, run, ['plugin', 'install', PLUGIN, '--scope', scope]) : add;
  results.push({ what: `plugin ${PLUGIN}`, status: inst.ok ? 'installed' : 'FAILED', note: inst.ok ? '' : lastLine(inst.out) });
  results.push(inst.ok ? configureGuard(t, run, guard) : { what: 'commit guard', status: 'FAILED', note: 'plugin not installed' });

  results.push(...applyKit(t, saved, { options, mp, force }));
  Object.assign(saved, { scope, options, marketplace: mp, packs, guard });
  saveSaved(t, saved);

  if (packs.includes('design')) for (const id of THIRD_PARTY.packs.design) results.push(...installTool(id, { scope, dir, prof, run }));
  return results;
}
