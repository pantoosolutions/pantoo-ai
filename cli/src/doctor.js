import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { hash, readIfExists, readJson, sameText } from './files.js';
import { kitRoot } from './paths.js';
import { merge } from './settings.js';
import { spawn } from './spawn.js';
import { OPTIONS, PLUGIN, agentFiles } from './install.js';
import { OLD_MACHINE_RULES, detectMachine, writeMachineRule } from './machine.js';
import { MANIFEST, PROJECT_FILE, detect, templatesDir } from './scaffold.js';
import { sourceChecks } from './sources.js';
import { PLACEHOLDER } from '../../plugin/skills/start-project/scripts/state.mjs';
import { COMPANIONS, TOOLS, designMissing, installedRefs, pinOf } from './third-party.js';

const V1_SKILLS = ['architect', 'remember', 'recover', 'review', 'imprint', 'find-docs'];
const KIT_AGENTS = fs.readdirSync(path.join(kitRoot, 'plugin', 'agents')).map((f) => f.replace(/\.md$/, ''));

// Each check is { level: 'ok' | 'warn' | 'fail', what, note }.
// `dir` adds the checks for the project there, when it has a .pantoo.json.
// A project-only setup (init --scope project, no user config) skips the user checks.
export function doctor(prof, dir, { user = true, machine } = {}) {
  const projectOnly = dir && !readJson(prof.configFile, null) && readJson(path.join(dir, PROJECT_FILE), {}).init;
  const checks = user && !projectOnly ? userChecks(prof, machine) : [];
  if (dir) checks.push(...projectChecks(dir, prof));
  return checks;
}

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

export function thirdPartyChecks(prof, config) {
  const checks = [];
  const add = (level, what, note = '') => checks.push({ level, what, note });
  for (const [id, rec] of Object.entries(config.thirdParty ?? {})) {
    const tool = TOOLS[id];
    if (!tool) continue;
    const missing = tool.skills.filter((s) => !fs.existsSync(path.join(prof.claudeDir, 'skills', s)));
    if (missing.length) add('fail', `design tool ${id}`, `${missing.join(', ')} missing; run \`npx pantoo-ai update\``);
    else add(rec.pin === pinOf(id) ? 'ok' : 'warn', `design tool ${id}`, rec.pin === pinOf(id) ? '' : 'older pin; run update');
  }
  const global = COMPANIONS.filter((c) => fs.existsSync(path.join(prof.claudeDir, 'skills', c)));
  if (global.length) add('warn', 'companions installed globally', `${global.join(', ')} installed globally; companions are per project now (D15)`);
  return checks;
}

// Detects the machine, refreshes rules/machine.md, and flags what Claude Code needs on it.
export function machineChecks(prof, info) {
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
  if (!info.python) checks.push({ level: 'warn', what: 'python', note: 'no working python on PATH; skills that run scripts need one' });
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

function userChecks(prof, machine) {
  const checks = [];
  const add = (level, what, note = '') => checks.push({ level, what, note });
  const config = readJson(prof.configFile, null);

  const major = Number(process.versions.node.split('.')[0]);
  add(major >= 20 ? 'ok' : 'fail', `node ${process.versions.node}`, major >= 20 ? '' : 'needs Node 20 or newer');

  checks.push(...machineChecks(prof, machine ?? detectMachine()));

  const list = pluginList(prof);
  if (list.error) {
    add('fail', 'claude CLI', 'not found on PATH');
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
  const snippet = readJson(path.join(kitRoot, 'settings', 'settings-snippet.json'), {});
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
    for (const k of opt.settings) {
      add(k in settings ? 'ok' : 'fail', `settings.json ${k}`, k in settings ? '' : 'missing');
      // Only the kit's own keys count: extra keys (the Git Bash path, your own) are not a difference.
      const diff = k in settings && merge({ [k]: settings[k] }, { [k]: snippet[k] });
      if (diff && (diff.added.length || diff.kept.length)) {
        checks[checks.length - 1] = { level: 'warn', what: `settings.json ${k}`, note: 'differs from the kit value (yours kept)' };
      }
    }
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

// `Rules: vN` near the top of security.md; a file without the line predates it, so it's v1.
export const rulesVersion = (text) => Number(text.match(/^Rules: v(\d+)/m)?.[1] ?? 1);
const SECURITY = 'context/security.md';
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
    add(on ? 'ok' : error ? 'warn' : 'fail', `plugin ${PLUGIN} (project)`, on ? '' : error ? 'claude CLI not found' : 'not installed for this project; run `npx pantoo-ai init --scope project`');
  }
  if (!found.project) {
    if (found.v1.length) add('warn', `context/ in ${dir}`, 'v1 layout; run `npx pantoo-ai new`, then /pantoo:start-project to migrate');
    return checks;
  }
  const project = found.project;
  add('ok', `project ${project.name}`, `${project.kind}${project.local ? ', local only' : ''}`);

  if (found.v1.length || project.layout < MANIFEST.layout) {
    add('warn', 'context layout', `v${project.layout}, the kit writes v${MANIFEST.layout}; run /pantoo:start-project to migrate`);
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

  const refs = installedRefs(dir);
  const pin = TOOLS['ui-ux-pro-max'].sha;
  for (const c of project.companions ?? []) {
    if (!fs.existsSync(path.join(dir, '.claude', 'skills', c))) add('fail', `companion ${c}`, 'missing; run `npx pantoo-ai update`');
    else add(refs[c] === pin ? 'ok' : 'warn', `companion ${c}`, refs[c] === pin ? '' : 'older or unknown pin; run update');
  }
  if (project.ui) {
    const missing = designMissing({ dir, prof });
    if (missing.length) add('warn', `design pack: ${missing.join(', ')} not installed`, 'run `npx pantoo-ai add design`');
  }
  checks.push(...sourceChecks(dir, prof, project));

  if (project.shared) {
    const settings = readJson(path.join(dir, '.claude', 'settings.json'), {});
    const on = settings.enabledPlugins?.[PLUGIN] === true;
    add(on ? 'ok' : 'warn', '.claude/settings.json', on ? 'plugin enabled for the team' : `${PLUGIN} not enabled; teammates won't be pointed at it`);
  }
  if (found.isRepo && !project.local) {
    const ignored = spawnSync('git', ['-C', dir, 'check-ignore', '-q', 'context/session.md']).status === 0;
    add(ignored ? 'ok' : 'warn', 'context/session.md', ignored ? 'gitignored' : 'not gitignored; personal session notes would be committed');
  }
  return checks;
}
