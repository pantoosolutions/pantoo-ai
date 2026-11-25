import fs from 'node:fs';
import path from 'node:path';
import { hash, readIfExists, readJson, sameText, writeJson } from './files.js';
import { kitRoot } from './paths.js';
import { merge } from './settings.js';
import { spawn } from './spawn.js';
import { OPTIONS, PLUGIN, agentFiles } from './install.js';
import { OLD_MACHINE_RULES, detectMachine, findBrowser, realSystem, writeMachineRule } from './machine.js';
import { MANIFEST, PROJECT_FILE, detect, templatesDir } from './scaffold.js';
import { setupChecks } from './setup-checks.js';
import { secretChecks, plain } from './secrets.js';
import { sourceChecks } from './sources.js';
import { git } from './spawn.js';
import { PLACEHOLDER } from '../../plugin/skills/start-project/scripts/state.mjs';
import { COMPANIONS, TOOLS, designMissing, readHolds, skillState, stateRow, toolState } from './third-party.js';

const V1_SKILLS = ['architect', 'remember', 'recover', 'review', 'imprint', 'find-docs'];
const KIT_AGENTS = fs.readdirSync(path.join(kitRoot, 'plugin', 'agents')).map((f) => f.replace(/\.md$/, ''));

// Each check is { level: 'ok' | 'warn' | 'fail', what, note }.
// `dir` adds the checks for the project there, when it has a .pantoo.json.
// A project-only setup (init --scope project, no user config) skips the user checks.
export function doctor(prof, dir, { user = true, machine, system = realSystem() } = {}) {
  const projectOnly = dir && !readJson(prof.configFile, null) && readJson(path.join(dir, PROJECT_FILE), {}).init;
  const roots = [path.join(prof.claudeDir, 'skills'), ...(dir ? [path.join(dir, '.claude', 'skills')] : [])];
  const info = user ? machine ?? detectMachine(system) : null;
  const checks = user && !projectOnly ? userChecks(prof, info, pythonUsers(roots)) : [];
  if (user) checks.push(...setupChecks(system, { dir, home: prof.home, gitBash: info.gitBash }));
  if (dir) checks.push(...projectChecks(dir, prof));
  checks.push(...tasteChecks(roots, system));
  return checks;
}

// The installed skills whose scripts are Python.
export function pythonUsers(roots) {
  return ['ui-ux-pro-max', ...COMPANIONS].filter((s) => roots.some((r) => fs.existsSync(path.join(r, s))));
}

// taste's page checker needs Node 22 and a Chromium browser. Only a copy that ships the checker
// needs them, so an older, held one doesn't.
export function tasteChecks(roots, sys = realSystem()) {
  if (!roots.some((r) => fs.existsSync(path.join(r, TOOLS.taste.skills[0], 'scripts', 'gate.mjs')))) return [];
  const node = Number(sys.nodeVersion.split('.')[0]) >= 22;
  const browser = findBrowser(sys);
  return [
    { level: node ? 'ok' : 'warn', what: 'Node 22 for taste', note: node ? '' : `this is ${sys.nodeVersion}; taste's page checker needs Node 22 or newer` },
    { level: browser ? 'ok' : 'warn', what: 'browser for taste', note: browser ?? 'no Chrome, Edge or Chromium found; install one, or set CHROME_PATH' },
  ];
}

const CLAUDE_MISSING = 'not found on PATH; install the `claude` CLI (the VS Code extension alone doesn\'t add it): https://code.claude.com/docs/en/setup';

function pluginList(prof, cwd) {
  const list = spawn('claude', ['plugin', 'list', '--json'], { env: prof.env, cwd });
  if (list.error) return { error: true, plugins: [] };
  try {
    return { error: false, plugins: JSON.parse(list.stdout) };
  } catch {
    return { error: false, bad: true, plugins: [] };
  }
}

// The guard mode is stored under pluginConfigs by `claude plugin configure`; the exact shape is
// read leniently (options.commit_guard, userConfig.commit_guard or commit_guard).
export function guardMode(settings) {
  const entry = Object.entries(settings.pluginConfigs ?? {}).find(([k]) => k.includes('pantoo'))?.[1];
  return entry?.options?.commit_guard ?? entry?.userConfig?.commit_guard ?? entry?.commit_guard ?? null;
}

// `update` skips a held tool, so a missing one is only restored after releasing it.
const restore = (id, holds) => (Object.hasOwn(holds, id) ? `it is held, so run \`npx pantoo-ai update --release ${id}\`` : 'run `npx pantoo-ai update`');

// One row per recorded tool, from what its folder holds. The saved pin only says the kit put it there.
export function toolChecks(root, recorded = {}, holds = {}) {
  return Object.keys(recorded).filter((id) => TOOLS[id]).map((id) => {
    const what = `design tool ${id}`;
    const missing = TOOLS[id].skills.filter((s) => !fs.existsSync(path.join(root, s)));
    if (missing.length) return { level: 'fail', what, note: `${missing.join(', ')} missing; ${restore(id, holds)}` };
    const state = toolState(id, { root, hold: holds[id] });
    const row = stateRow(state);
    // A tool with several skills names the one that differs; ok and held cover them all.
    const named = TOOLS[id].skills.length > 1 && !['ok', 'held'].includes(state.state);
    return { what, ...row, note: named ? `${state.name}: ${row.note}` : row.note };
  });
}

export function thirdPartyChecks(prof, config) {
  const checks = toolChecks(path.join(prof.claudeDir, 'skills'), config.thirdParty, config.holds);
  const add = (level, what, note = '') => checks.push({ level, what, note });
  const global = COMPANIONS.filter((c) => fs.existsSync(path.join(prof.claudeDir, 'skills', c)));
  if (global.length) add('warn', 'companions installed globally', `${global.join(', ')} installed globally; companions are per project now (D15)`);
  return checks;
}

// Detects the machine, refreshes rules/machine.md, and flags what Claude Code needs on it.
export function machineChecks(prof, info, { pythonFor = [] } = {}) {
  const checks = [];
  const wrote = writeMachineRule(prof.claudeDir, info);
  checks.push(wrote === 'foreign'
    ? { level: 'warn', what: 'rule machine.md', note: 'left alone: it is not the kit\'s (no "Written by `npx pantoo-ai doctor`" line); move it aside to let doctor write one' }
    : { level: 'ok', what: 'rule machine.md', note: `${wrote}: ${info.os} ${info.arch}` });
  if (info.os === 'Windows') {
    checks.push(info.gitBash
      ? { level: 'ok', what: 'Git Bash', note: info.gitBash }
      : { level: 'fail', what: 'Git Bash', note: 'not found; install Git for Windows, or set CLAUDE_CODE_GIT_BASH_PATH' });
  }
  if (!info.python) {
    checks.push(pythonFor.length
      ? { level: 'fail', what: 'python', note: `no working python on PATH, and ${pythonFor.join(', ')} run${pythonFor.length > 1 ? '' : 's'} on it; install Python 3` }
      : { level: 'warn', what: 'python', note: 'no working python on PATH; skills that run scripts need one' });
  }
  return checks;
}

const LOCAL_FIX = 'dev mode: every project runs this clone\'s checked-out branch; run `claude plugin marketplace remove pantoo-ai`, then `npx pantoo-ai@latest init`, and test kit changes with `claude --plugin-dir <clone>/plugin`';

// Dev mode = the marketplace points at a local clone, not GitHub.
export function marketplaceChecks(prof, saved) {
  let entry;
  try {
    entry = readJson(path.join(prof.claudeDir, 'plugins', 'known_marketplaces.json'), {})?.['pantoo-ai'];
  } catch { return []; }
  const src = entry?.source;
  const local = src?.source === 'directory' || (typeof saved === 'string' && fs.existsSync(saved));
  if (local) return [{ level: 'warn', what: 'marketplace pantoo-ai', note: LOCAL_FIX }];
  if (src?.source === 'github') return [{ level: 'ok', what: 'marketplace pantoo-ai', note: src.repo ?? '' }];
  return [];
}

// D34: the kit value a settings key had when its owner accepted their own value. A new kit value
// changes the hash, so doctor warns again.
const kitValueHash = (value) => hash(JSON.stringify(value ?? null));
const kitSnippet = () => readJson(path.join(kitRoot, 'settings', 'settings-snippet.json'), {});

// `doctor --accept <key>`: records that a settings difference is meant. Only the keys the saved
// options manage, and only while they differ; returns [{ what, status, note }].
export function acceptSettings(prof, keys) {
  if (!keys.length) return [];
  const config = readJson(prof.configFile, null);
  if (!config) throw new Error(`Accepted settings are saved in ${prof.configFile}, which doesn't exist; run \`npx pantoo-ai init\` first.`);
  const managed = (config.options ?? []).flatMap((id) => OPTIONS[id]?.settings ?? []);
  const unknown = keys.find((k) => !managed.includes(k));
  if (unknown) throw new Error(`Can't accept "${unknown}": the kit manages ${managed.length ? managed.join(', ') : 'no settings keys'} on this machine.`);
  const settings = readJson(path.join(prof.claudeDir, 'settings.json'), {});
  const snippet = kitSnippet();
  const accepted = { ...config.accepted };
  const results = [];
  for (const k of keys) {
    const now = settingsCheck(k, settings, snippet).level;
    if (now === 'fail') results.push({ what: `accept ${k}`, status: 'not saved', note: 'missing from settings.json; run update' });
    else if (now === 'ok') results.push({ what: `accept ${k}`, status: 'not needed', note: 'already the kit value' });
    else {
      accepted[k] = kitValueHash(snippet[k]);
      results.push({ what: `accept ${k}`, status: 'saved', note: 'doctor shows it as yours until the kit value changes' });
    }
  }
  if (Object.keys(accepted).length) config.accepted = accepted;
  writeJson(prof.configFile, config);
  return results;
}

// One kit-managed settings key: missing, the kit's, accepted as yours (D34), or different.
export function settingsCheck(k, settings, snippet, accepted = {}) {
  const what = `settings.json ${k}`;
  if (!(k in settings)) return { level: 'fail', what, note: 'missing' };
  // Only the kit's own keys count: extra keys (the Git Bash path, your own) are not a difference.
  const diff = merge({ [k]: settings[k] }, { [k]: snippet[k] });
  if (!diff.added.length && !diff.kept.length) return { level: 'ok', what, note: '' };
  if (accepted[k] === kitValueHash(snippet[k])) return { level: 'ok', what, note: 'yours, accepted' };
  return { level: 'warn', what, note: accepted[k]
    ? `the kit value changed since you accepted yours (yours kept); \`npx pantoo-ai doctor --accept ${k}\` again if you still mean it`
    : `differs from the kit value (yours kept); \`npx pantoo-ai doctor --accept ${k}\` if you meant it` };
}

function userChecks(prof, info, pythonFor) {
  const checks = [];
  const add = (level, what, note = '') => checks.push({ level, what, note });
  const config = readJson(prof.configFile, null);

  const major = Number(process.versions.node.split('.')[0]);
  add(major >= 20 ? 'ok' : 'fail', `node ${process.versions.node}`, major >= 20 ? '' : 'needs Node 20 or newer');

  checks.push(...machineChecks(prof, info, { pythonFor }));

  const list = pluginList(prof);
  if (list.error) {
    add('fail', 'claude CLI', CLAUDE_MISSING);
  } else {
    if (list.bad) add('warn', 'plugin list', 'could not read `claude plugin list --json`');
    const found = list.plugins.find?.((p) => p.id === PLUGIN || p.name === 'pantoo');
    add(found ? 'ok' : 'fail', `plugin ${PLUGIN}`, found ? '' : `not installed; run \`npx pantoo-ai init\` (or just \`claude plugin install ${PLUGIN}\`)`);
  }

  checks.push(...marketplaceChecks(prof, config?.marketplace));

  if (!config) {
    add('fail', 'saved choices', `${prof.configFile} missing; run \`npx pantoo-ai init\``);
    return checks;
  }

  for (const f of agentFiles()) {
    const dest = path.join(prof.claudeDir, 'agents', f);
    const current = readIfExists(dest);
    add(current === null ? 'fail' : 'ok', `agent ${f}`, current === null ? 'missing' : '');
  }

  const settings = readJson(path.join(prof.claudeDir, 'settings.json'), {});
  const snippet = kitSnippet();
  for (const id of config.options ?? []) {
    const opt = OPTIONS[id];
    if (!opt) continue;
    for (const f of opt.rules) {
      const dest = path.join(prof.claudeDir, 'rules', f);
      const current = readIfExists(dest);
      const kit = fs.readFileSync(path.join(kitRoot, 'rules', f), 'utf8');
      if (current === null) add('fail', `rule ${f}`, 'missing');
      else if (sameText(current, kit)) add('ok', `rule ${f}`);
      else add('warn', `rule ${f}`, hash(current) === config.files?.[dest] ? 'older kit version; run update' : 'edited by you, differs from the kit');
    }
    for (const k of opt.settings) checks.push(settingsCheck(k, settings, snippet, config.accepted));
  }

  const mode = guardMode(settings);
  add(mode === null || ['block', 'warn', 'off'].includes(mode) ? 'ok' : 'warn', 'commit guard', mode === null ? 'block (default)' : mode);
  checks.push(...thirdPartyChecks(prof, config));

  // Leftovers from the pre-plugin setup, which would answer to the same names.
  for (const dir of [path.join(prof.claudeDir, 'skills'), path.join(prof.home, '.agents', 'skills')]) {
    const old = V1_SKILLS.filter((s) => fs.existsSync(path.join(dir, s)));
    if (old.length) add('warn', `old skills in ${dir}`, `${old.join(', ')} (superseded by the pantoo skills)`);
  }
  const oldRules = OLD_MACHINE_RULES.filter((f) => fs.existsSync(path.join(prof.claudeDir, 'rules', f)));
  if (oldRules.length) add('warn', 'hand-written machine rules', `${oldRules.join(', ')} (superseded by machine.md; delete them)`);
  const dupes = KIT_AGENTS.filter((a) => fs.existsSync(path.join(prof.claudeDir, 'agents', `${a}.md`)));
  if (dupes.length) add('warn', 'agents duplicated outside the plugin', `${dupes.join(', ')} in ${path.join(prof.claudeDir, 'agents')}`);

  return checks;
}

// Tracked files that are CRLF on disk, split by what git holds for them. Files whose attributes
// ask for CRLF (batch files) are right as they are. Null when git can't list them.
export function crlfFiles(dir) {
  const r = git(dir, ['ls-files', '--eol', '-z']);
  if (!r.ok) return null;
  const found = { checkout: [], index: [] };
  for (const entry of r.out.split('\0')) {
    // `<info>\t<path>`; the path itself can hold a tab.
    const tab = entry.indexOf('\t');
    if (tab === -1) continue;
    const [info, file] = [entry.slice(0, tab), entry.slice(tab + 1)];
    if (!/\sw\/crlf\s/.test(info) || info.includes('eol=crlf')) continue;
    found[info.startsWith('i/lf ') ? 'checkout' : 'index'].push(file);
  }
  return found;
}

const some = (files) => `${files.length} file(s), e.g. ${files[0]}`;

export function lineEndingChecks(dir, { local = false } = {}) {
  const checks = [];
  const add = (level, what, note = '') => checks.push({ level, what, note });
  // In a monorepo the project can sit below the file that covers it.
  const top = git(dir, ['rev-parse', '--show-toplevel']).out.trim();
  const has = [dir, top].some((d) => d && fs.existsSync(path.join(d, '.gitattributes')));
  // A local-only setup is in someone else's repo, which isn't asked to commit a file.
  if (!has && !local) add('warn', '.gitattributes', 'none; add one with `* text=auto eol=lf` and commit it');
  const crlf = crlfFiles(dir);
  if (crlf?.checkout.length) add('warn', 'line endings', `CRLF on disk, LF in git: ${some(crlf.checkout)}; \`npx pantoo-ai doctor --fix line-endings\` repairs them`);
  if (crlf?.index.length) add('warn', 'line endings in git', `committed with CRLF: ${some(crlf.index)}; run \`git add --renormalize .\` and commit`);
  if (has && crlf && !crlf.checkout.length && !crlf.index.length) add('ok', 'line endings');
  return checks;
}

export const FIXES = ['line-endings'];

// Rewrites the files that are CRLF on disk but LF in git, from the index. Only on a clean tree with
// a committed .gitattributes, so the index holds the same content. Never reset, never rm --cached.
// Returns { status: 'repaired' | 'unchanged' | 'skipped' | 'failed', note }.
export function repairLineEndings(dir, { cwd } = {}) {
  const top = git(dir, ['rev-parse', '--show-toplevel'], { cwd });
  if (!top.ok) return { status: 'skipped', note: 'not a git repo' };
  const root = path.resolve(top.out.trim());
  const status = git(root, ['status', '--porcelain'], { cwd });
  if (!status.ok || status.out.trim()) return { status: 'skipped', note: 'the tree has changes; commit or stash them, then run `npx pantoo-ai doctor --fix line-endings`' };
  if (!git(root, ['ls-files', '--error-unmatch', '--', '.gitattributes'], { cwd }).ok) return { status: 'skipped', note: 'no committed .gitattributes; add one with `* text=auto eol=lf` and commit it' };
  const files = (crlfFiles(root)?.checkout ?? []).filter((f) => fs.lstatSync(path.join(root, f), { throwIfNoEntry: false })?.isFile());
  if (!files.length) return { status: 'unchanged', note: 'no CRLF working files' };
  // With a clean tree git sees these files as unchanged, so a plain checkout rewrites nothing.
  // So each one is removed first, and kept here until git has written it again.
  const before = files.map((f) => {
    const abs = path.join(root, f);
    return { abs, buf: fs.readFileSync(abs), mode: fs.statSync(abs).mode };
  });
  for (const { abs } of before) fs.rmSync(abs, { force: true });
  const out = git(root, ['checkout', '--pathspec-from-file=-', '--pathspec-file-nul'], { cwd, input: files.join('\0') });
  if (!out.ok) {
    for (const { abs, buf, mode } of before) if (!fs.existsSync(abs)) fs.writeFileSync(abs, buf, { mode });
    return { status: 'failed', note: `git checkout failed; no file was lost (${out.err.trim().split('\n')[0]})` };
  }
  const left = crlfFiles(root)?.checkout ?? [];
  if (left.length) return { status: 'failed', note: `still CRLF: ${some(left)}` };
  return { status: 'repaired', note: `${files.length} file(s) now LF` };
}

// `Rules: vN` near the top of security.md; a file without the line predates it, so it's v1.
export const rulesVersion = (text) => Number(text.match(/^Rules: v(\d+)/m)?.[1] ?? 1);
const SECURITY = 'context/security.md';
const COPY = 'context/copy.md';
const AUTOMATIONS = 'context/automations.md';
const KIT_RULES = rulesVersion(fs.readFileSync(path.join(templatesDir, SECURITY), 'utf8'));

// The pattern is shared with start-project's state script, so the two agree.
const placeholders = (text) => text.split('\n').filter((l) => PLACEHOLDER.test(l)).length;

export function projectChecks(dir, prof) {
  const checks = [];
  const add = (level, what, note = '') => checks.push({ level, what, note });
  const found = detect(dir);
  if (found.init?.scope === 'project') {
    const { error, plugins } = pluginList(prof, dir);
    const on = plugins.find?.((p) => (p.id === PLUGIN || p.name === 'pantoo') && p.scope === 'project');
    add(on ? 'ok' : error ? 'warn' : 'fail', `plugin ${PLUGIN} (project)`, on ? '' : error ? CLAUDE_MISSING : 'not installed for this project; run `npx pantoo-ai init --scope project`');
  }
  if (!found.project) {
    if (found.v1.length) add('warn', `context/ in ${dir}`, 'v1 layout; run `npx pantoo-ai new`, then /pantoo:start-project to migrate');
    return checks;
  }
  const project = found.project;
  add('ok', `project ${plain(project.name)}`, `${plain(project.kind)}${project.local ? ', local only' : ''}`);

  if (project.layout < MANIFEST.layout) {
    add('warn', 'context layout', `v${project.layout}, the kit writes v${MANIFEST.layout}; run /pantoo:start-project to migrate`);
  } else if (found.v1.length) {
    add('warn', 'context layout', `v1 files left: ${found.v1.join(', ')}; /pantoo:start-project moves them`);
  }
  // A v1 context gets these files when it migrates, and the layout warning already covers that.
  const owed = !found.v1.length && project.layout >= MANIFEST.layout && fs.existsSync(path.join(dir, 'context'));
  for (const [rel, due] of [[COPY, project.ui], [AUTOMATIONS, project.kind === 'automation']]) {
    if (owed && due && !fs.existsSync(path.join(dir, rel))) add('warn', rel, 'missing; run /pantoo:start-project to add it');
  }
  if (fs.existsSync(path.join(dir, 'memory.md'))) add('warn', 'memory.md', 'v1 session file; save-session uses context/session.md');

  // roadmap.md is plan-roadmap's, not the intake's.
  const files = Object.keys(MANIFEST.files).filter((rel) => rel.endsWith('.md') && rel !== 'context/roadmap.md' && fs.existsSync(path.join(dir, rel)));
  const open = files.filter((rel) => placeholders(fs.readFileSync(path.join(dir, rel), 'utf8')) > 0);
  add(open.length ? 'warn' : 'ok', 'intake', open.length ? `placeholders left in ${open.length} file(s); run /pantoo:start-project` : 'complete');

  const security = readIfExists(path.join(dir, SECURITY));
  if (security !== null) {
    const v = rulesVersion(security);
    add(v < KIT_RULES ? 'warn' : 'ok', 'security rules', v < KIT_RULES ? `v${v}, the kit has v${KIT_RULES}; run /pantoo:start-project to update them` : `v${v}`);
  }

  const root = path.join(dir, '.claude', 'skills');
  const holds = readHolds(prof);
  checks.push(...toolChecks(root, found.init?.thirdParty, holds));
  for (const c of project.companions ?? []) {
    // The names come from the project's file, so only the kit's own are looked up.
    if (!COMPANIONS.includes(c)) add('warn', `companion ${plain(c, 80)}`, 'not a companion this kit knows');
    else if (!fs.existsSync(path.join(root, c))) add('fail', `companion ${c}`, `missing; ${restore('ui-ux-pro-max', holds)}`);
    else checks.push({ what: `companion ${c}`, ...stateRow(skillState('ui-ux-pro-max', { name: c, root, hold: holds['ui-ux-pro-max'] })) });
  }
  if (project.companions?.includes('ui-styling') && fs.existsSync(path.join(dir, 'components.json'))) {
    add('warn', 'companion ui-styling', 'the kit now recommends the official `shadcn` skill: install it (the start-project catalog has the command), then delete .claude/skills/ui-styling and its entry in .pantoo.json');
  }
  if (project.ui) {
    const missing = designMissing({ dir, prof });
    if (missing.length) add('warn', `design pack: ${missing.join(', ')} not installed`, 'run `npx pantoo-ai add design`');
  }
  checks.push(...sourceChecks(dir, prof, project));
  checks.push(...secretChecks(dir, prof));

  if (project.shared) {
    const settings = readJson(path.join(dir, '.claude', 'settings.json'), {});
    const on = settings.enabledPlugins?.[PLUGIN] === true;
    add(on ? 'ok' : 'warn', '.claude/settings.json', on ? 'plugin enabled for the team' : `${PLUGIN} not enabled; teammates won't be pointed at it`);
  }
  if (found.isRepo) checks.push(...lineEndingChecks(dir, project));
  if (found.isRepo && !project.local) {
    const ignored = git(dir, ['check-ignore', '-q', '--', 'context/session.md']).ok;
    add(ignored ? 'ok' : 'warn', 'context/session.md', ignored ? 'gitignored' : 'not gitignored; personal session notes would be committed');
  }
  return checks;
}
