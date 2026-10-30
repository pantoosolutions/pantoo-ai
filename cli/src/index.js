import path from 'node:path';
import { parseArgs } from 'node:util';
import * as p from '@clack/prompts';
import { doctor } from './doctor.js';
import { GUARDS, OPTIONS, install } from './install.js';
import { add, addNames, remove, update } from './manage.js';
import { profile } from './paths.js';
import { VERSION, selfUpdate } from './self-update.js';
import { SOURCES, addSource } from './sources.js';
import { KINDS, PROJECT_FILE, detect, hideCompanions, scaffold } from './scaffold.js';
import { COMPANIONS, THIRD_PARTY, defaultRun, designMissing, installCompanions } from './third-party.js';

const HELP = `pantoo-ai <command>   (--version prints the version)

  init      install the kit: plugin, rules, settings, commit guard, design pack
  new       scaffold context v2 in this folder (never overwrites) and install its design companions
  add       add one piece later: pantoo-ai add <name>
  update    replay the saved choices and move third-party pins
  remove    undo init for a scope, from the saved record
  doctor    check what is installed against what is expected (and this project, if set up)

init flags
  --yes                   accept the defaults, no prompts
  --scope user|project    user = every project on this machine (default); project = this git repo, shared
  --dir <dir>             the repo for --scope project, default the current folder
  --no-<option>           skip an option: ${Object.keys(OPTIONS).join(', ')}
  --no-design             skip the design pack (${THIRD_PARTY.packs.design.join(', ')})
  --guard block|warn|off  commit guard mode, default block
  --marketplace <source>  plugin marketplace (repo or local path), default pantoosolutions/pantoo-ai
  --force                 replace files you have edited (a backup is kept)
  --home <dir>            install into another profile, for testing

new flags
  --yes                   accept the defaults, no prompts
  --dir <dir>             the project folder, default the current one
  --name <name>           project name, default the folder name
  --kind <kind>           ${Object.keys(KINDS).join(', ')} (default web-app)
  --existing | --greenfield   code already exists or not (detected by default)
  --multi-surface         several apps share a contract (adds context/contracts.md)
  --local                 keep everything out of git (.git/info/exclude, CLAUDE.local.md)
  --no-share              don't enable the plugin for teammates in .claude/settings.json
  --no-companions         record the design companions but don't install them
  --source <tool>         where the design lives (UI projects): ${Object.keys(SOURCES.tools).join(', ')}

add <name> flags
  <name>                  a companion (${COMPANIONS.join(', ')}) in --dir, "design" for the design pack,
                          or an option (${Object.keys(OPTIONS).join(', ')})
  --companion             with "design": add the design companion instead of the design pack

add source <tool>         record a design source; tools with an official MCP server get it in .mcp.json
  --dir <dir>             the project folder, default the current one
  --force, --home <dir>   as in init

update flags
  --dir <dir>             the project folder, default the current one (project choices replayed too)
  --no-self-update        don't re-run through a newer pantoo-ai from npm
  --force, --home <dir>   as in init

remove flags
  --scope user|project    which install to undo, default user
  --dir <dir>             the repo for --scope project
  --third-party           also remove the design tools (kept by default)
  --yes                   don't ask for confirmation
  --home <dir>            as in init

doctor flags
  --dir <dir>             the project folder, default the current one
  --home <dir>            check another profile
`;

const ICON = { ok: '✓', warn: '!', fail: '✗' };

function printChecks(checks) {
  for (const c of checks) console.log(`${ICON[c.level]} ${c.what}${c.note ? `  (${c.note})` : ''}`);
  const fails = checks.filter((c) => c.level === 'fail').length;
  const warns = checks.filter((c) => c.level === 'warn').length;
  console.log(fails ? `\n${fails} problem(s), ${warns} warning(s).` : `\nAll good${warns ? `, ${warns} warning(s)` : ''}.`);
  return fails ? 1 : 0;
}

const show = (results) => { for (const r of results) console.log(`${r.status === 'FAILED' ? '✗' : '✓'} ${r.what}: ${r.status}${r.note ? `  (${r.note})` : ''}`); };
const interactive = (values) => !values.yes && process.stdin.isTTY;

async function runInit(values, run) {
  if (values.scope && !['user', 'project'].includes(values.scope)) throw new Error('--scope must be user or project.');
  if (values.guard && !GUARDS.includes(values.guard)) throw new Error(`--guard must be one of: ${GUARDS.join(', ')}`);
  const prof = profile(values.home);
  const ids = Object.keys(OPTIONS);
  let scope = values.scope ?? 'user';
  let design = !values['no-design'];
  let guard = values.guard ?? 'block';
  let options = ids.filter((id) => !values[`no-${id}`]);
  if (interactive(values)) {
    p.intro('pantoo-ai init');
    const answers = await p.group(
      {
        scope: () => p.select({ message: 'Scope', initialValue: scope, options: [{ value: 'user', label: 'User: every project on this machine' }, { value: 'project', label: 'Project: this git repo, shared with the team' }] }),
        guard: () => p.select({ message: 'Commit guard (blocks AI attribution in commits)', initialValue: guard, options: GUARDS.map((value) => ({ value, label: value })) }),
        design: () => p.confirm({ message: `Design pack (${THIRD_PARTY.packs.design.join(', ')})?`, initialValue: design }),
        options: () => p.multiselect({ message: 'Options (space to toggle)', options: ids.map((id) => ({ value: id, label: OPTIONS[id].label })), initialValues: options, required: false }),
      },
      { onCancel: () => { p.cancel('Nothing changed.'); process.exit(0); } },
    );
    ({ scope, guard, design, options } = answers);
  }
  const dir = path.resolve(values.dir ?? '.');
  if (scope === 'project' && !detect(dir).isRepo) throw new Error(`--scope project needs a git repo: ${dir} is not one.`);
  const results = install({ prof, scope, dir, options, marketplace: values.marketplace, force: values.force, guard, packs: design ? ['design'] : [], run });
  show(results);
  console.log('\nDoctor:');
  process.exitCode = printChecks(doctor(prof, scope === 'project' ? dir : undefined));
}

async function runNew(values, run) {
  const dir = path.resolve(values.dir ?? '.');
  const found = detect(dir);
  if (found.project) {
    console.log(`Already set up (${PROJECT_FILE}, layout ${found.project.layout}). Run /pantoo:start-project in Claude Code.`);
    return;
  }
  if (values.kind && !KINDS[values.kind]) throw new Error(`--kind must be one of: ${Object.keys(KINDS).join(', ')}`);
  if (values.source && !SOURCES.tools[values.source]) throw new Error(`--source must be one of: ${Object.keys(SOURCES.tools).join(', ')}`);
  const choices = {
    name: values.name ?? path.basename(dir),
    kind: values.kind ?? 'web-app',
    existing: values.existing ? true : values.greenfield ? false : found.hasCode,
    multiSurface: Boolean(values['multi-surface']),
    local: Boolean(values.local),
    share: !values['no-share'],
    source: values.source ?? null,
  };
  if (!values.yes && process.stdin.isTTY) {
    p.intro(`pantoo-ai new: ${dir}`);
    if (found.v1.length) p.note('A v1 context/ is here. It is left as is; /pantoo:start-project migrates it.');
    if (found.other.length) p.note(`Found ${found.other.join(', ')}. Nothing is overwritten; start-project folds them in.`);
    const answers = await p.group(
      {
        kind: () => p.select({ message: 'Project type', initialValue: choices.kind, options: Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label })) }),
        existing: () => p.confirm({ message: 'Is there code already?', initialValue: choices.existing }),
        multiSurface: () => p.confirm({ message: 'Several apps or repos sharing a schema or API?', initialValue: false }),
        local: () => p.confirm({ message: 'Keep the kit out of git? (team repo you shouldn\'t commit to)', initialValue: found.tracked.length > 0 && !found.v1.length }),
        share: ({ results }) => (results.local ? Promise.resolve(false) : p.confirm({ message: 'Enable the pantoo plugin for teammates (.claude/settings.json)?', initialValue: true })),
        source: ({ results }) => (!KINDS[results.kind].ui || choices.source ? Promise.resolve(choices.source) : p.select({
          message: 'Where does the design live?',
          initialValue: 'none',
          options: [{ value: 'none', label: 'Nowhere yet, or somewhere else (design-flow asks later)' }, ...Object.entries(SOURCES.tools).map(([value, t]) => ({ value, label: t.label }))],
        })),
      },
      { onCancel: () => { p.cancel('Nothing changed.'); process.exit(0); } },
    );
    Object.assign(choices, answers, { source: answers.source === 'none' ? null : answers.source });
  }
  choices.ui = KINDS[choices.kind].ui;
  show(scaffold(dir, choices));
  const prof = profile(values.home);
  const companions = detect(dir).project?.companions ?? [];
  if (companions.length && !values['no-companions']) {
    show(installCompanions(companions, { dir, prof, run }));
    if (choices.local && hideCompanions(dir, companions)) show([{ what: '.git/info/exclude', status: 'updated', note: 'companions hidden' }]);
  }
  if (choices.ui && choices.source) show(addSource({ name: choices.source, dir }));
  if (choices.ui && designMissing({ dir, prof }).length) show([{ what: 'design pack', status: 'missing', note: 'design pack missing; run `npx pantoo-ai add design`' }]);
  console.log('\nNext: open Claude Code in this folder and run /pantoo:start-project.');
}

async function runRemove(values, run) {
  const scope = values.scope ?? 'user';
  if (!['user', 'project'].includes(scope)) throw new Error('--scope must be user or project.');
  if (interactive(values)) {
    const ok = await p.confirm({ message: `Remove the pantoo-ai kit at ${scope} scope? Files you edited are kept.`, initialValue: false });
    if (p.isCancel(ok) || !ok) return p.cancel('Nothing changed.');
  }
  show(remove({ prof: profile(values.home), scope, dir: path.resolve(values.dir ?? '.'), thirdParty: values['third-party'], run }));
}

export async function main(argv, { run = defaultRun } = {}) {
  if (['--version', '-v'].includes(argv[0])) return console.log(VERSION);
  const [command, ...rest] = argv;
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      'no-self-update': { type: 'boolean' },
      yes: { type: 'boolean' },
      force: { type: 'boolean' },
      scope: { type: 'string' },
      home: { type: 'string' },
      marketplace: { type: 'string' },
      guard: { type: 'string' },
      dir: { type: 'string' },
      name: { type: 'string' },
      kind: { type: 'string' },
      existing: { type: 'boolean' },
      greenfield: { type: 'boolean' },
      'multi-surface': { type: 'boolean' },
      local: { type: 'boolean' },
      'no-share': { type: 'boolean' },
      'no-design': { type: 'boolean' },
      'no-companions': { type: 'boolean' },
      'third-party': { type: 'boolean' },
      companion: { type: 'boolean' },
      source: { type: 'string' },
      ...Object.fromEntries(Object.keys(OPTIONS).map((id) => [`no-${id}`, { type: 'boolean' }])),
    },
  });
  const dir = path.resolve(values.dir ?? '.');
  if (command === 'init') return runInit(values, run);
  if (command === 'new') return runNew(values, run);
  if (command === 'remove') return runRemove(values, run);
  if (command === 'update') {
    const code = await selfUpdate({ args: rest });
    if (code !== null) return void (process.exitCode = code);
    show(update({ prof: profile(values.home), dir, force: values.force, run }));
  } else if (command === 'add') {
    if (!positionals[0]) throw new Error(`add needs a name. Valid: ${addNames().join(', ')}, source <tool>.`);
    if (positionals[0] === 'source') return show(addSource({ name: positionals[1], dir }));
    show(add({ name: positionals[0], prof: profile(values.home), dir, force: values.force, companion: values.companion, run }));
  } else if (command === 'doctor') process.exitCode = printChecks(doctor(profile(values.home), dir));
  else console.log(HELP);
}
