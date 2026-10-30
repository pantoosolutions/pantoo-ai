import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readIfExists, readJson, writeFile, writeJson } from './files.js';
import { kitRoot } from './paths.js';
import { mergeSettings } from './settings.js';

export const templatesDir = path.join(kitRoot, 'plugin', 'templates');
export const MANIFEST = readJson(path.join(templatesDir, 'manifest.json'), null);
export const PROJECT_FILE = '.pantoo.json';

// Project kinds and the ui-ux-pro-max companions each one gets (PLAN.md 4b).
export const KINDS = {
  'web-app': { label: 'Web app, dashboard, SaaS', ui: true, companions: ['design-system'] },
  marketing: { label: 'Marketing site, landing', ui: true, companions: ['brand', 'banner-design'] },
  brand: { label: 'Brand or identity work', ui: true, companions: ['brand', 'design'] },
  pitch: { label: 'Pitch or presentation', ui: true, companions: ['slides'] },
  backend: { label: 'API, CLI, backend only', ui: false, companions: [] },
};

const CODE_MARKERS = [
  'package.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'Cargo.toml', 'Gemfile',
  'composer.json', 'pom.xml', 'build.gradle', 'pubspec.yaml', 'src', 'app', 'lib',
];
// Instructions written for other agents or by hand; start-project folds them into context/.
const OTHER_CONTEXT = [
  'CLAUDE.md', 'AGENTS.md', '.cursorrules', '.cursor/rules', '.windsurfrules', '.clinerules',
  '.github/copilot-instructions.md', 'docs/specs', 'docs/scope', 'memory.md',
];

const exists = (dir, rel) => fs.existsSync(path.join(dir, rel));

function git(dir, args) {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

export const isTracked = (dir, rel) => Boolean(git(dir, ['ls-files', '--', rel]));

// What is already in the folder, so `new` never writes over it.
export function detect(dir) {
  const v1 = Object.keys(MANIFEST.v1).filter((rel) => rel.startsWith('context/') && exists(dir, rel));
  // `init --scope project` can write .pantoo.json before `new` has run: no layout, not set up.
  const record = readJson(path.join(dir, PROJECT_FILE), null);
  return {
    project: record?.layout ? record : null,
    init: record?.init ?? null,
    v1,
    hasCode: CODE_MARKERS.some((m) => exists(dir, m)),
    other: OTHER_CONTEXT.filter((rel) => exists(dir, rel)),
    tracked: ['CLAUDE.md', 'AGENTS.md'].filter((rel) => isTracked(dir, rel)),
    shadcn: exists(dir, 'components.json'),
    isRepo: git(dir, ['rev-parse', '--git-dir']) !== null,
  };
}

function applies(rule, choices) {
  if (rule === 'always') return true;
  if (rule === 'shared') return !choices.local;
  if (rule === 'local') return choices.local;
  if (rule === 'existing') return choices.existing;
  if (rule === 'multi-surface') return choices.multiSurface;
  if (rule === 'ui') return choices.ui;
  return false;
}

// Template text for this project: name filled in, the UI-only tail kept or dropped.
function render(rel, choices) {
  let text = fs.readFileSync(path.join(templatesDir, rel), 'utf8');
  if (!rel.endsWith('.md')) return text;
  text = text.replaceAll('{{PROJECT_NAME}}', choices.name);
  const marker = text.indexOf('<!-- UI projects only');
  if (marker !== -1) {
    text = choices.ui
      ? text.slice(0, marker) + text.slice(text.indexOf('\n', marker) + 2)
      : `${text.slice(0, marker).trimEnd()}\n`;
  }
  if (rel === 'AGENTS.md' && choices.existing) {
    text = text.replace(
      '| `context/specs/`',
      '| `context/known-issues.md` | Debt and deviations; read before copying a pattern |\n| `context/specs/`',
    );
  }
  return text;
}

function appendLines(file, header, lines) {
  const current = readIfExists(file) ?? '';
  const missing = lines.filter((l) => !current.split('\n').includes(l));
  if (!missing.length) return false;
  const sep = current && !current.endsWith('\n') ? '\n' : '';
  writeFile(file, `${current}${sep}${current ? '\n' : ''}${header}\n${missing.join('\n')}\n`);
  return true;
}

// --local: adds paths to .git/info/exclude. False when nothing was added or `dir` isn't a repo.
export function excludeLocal(dir, lines) {
  const rel = git(dir, ['rev-parse', '--git-path', 'info/exclude']);
  if (!rel) return false;
  return appendLines(path.resolve(dir, rel), '# pantoo-ai: local only, never commit', lines);
}

// --local: keeps the companion folders and the lock file out of git too.
export const hideCompanions = (dir, names) => excludeLocal(dir, [...names.map((n) => `/.claude/skills/${n}/`), '/skills-lock.json']);

// Writes context v2 into `dir`. Returns [{ what, status, note }].
export function scaffold(dir, choices) {
  const results = [];
  const found = detect(dir);
  // A v1 context/ is migrated by start-project, which needs the old files intact.
  const skipContext = found.v1.length > 0;

  for (const [rel, rule] of Object.entries(MANIFEST.files)) {
    if (!applies(rule, choices)) continue;
    if (skipContext && (rel.startsWith('context/') || rel === 'AGENTS.md' || rel === 'CLAUDE.md')) continue;
    if (exists(dir, rel)) {
      results.push({ what: rel, status: 'kept', note: 'already there; start-project folds it in' });
      continue;
    }
    writeFile(path.join(dir, rel), render(rel, choices));
    results.push({ what: rel, status: 'added' });
  }
  if (skipContext) results.push({ what: 'context/', status: 'kept', note: `v1 layout; run /pantoo:start-project to migrate` });

  if (choices.local) {
    const exclude = found.isRepo ? path.resolve(dir, git(dir, ['rev-parse', '--git-path', 'info/exclude'])) : null;
    if (!exclude) throw new Error('--local needs a git repo (it hides the files in .git/info/exclude).');
    const paths = ['/context/', '/CLAUDE.local.md', `/${PROJECT_FILE}`, '/DESIGN.md', '/PRODUCT.md', '/.impeccable/', '/.impeccable-live/'];
    const lines = paths.filter((p) => !isTracked(dir, p.replace(/^\/|\/$/g, '')));
    const added = appendLines(exclude, '# pantoo-ai: local only, never commit', lines);
    results.push({ what: '.git/info/exclude', status: added ? 'updated' : 'unchanged' });
  } else {
    const added = appendLines(path.join(dir, '.gitignore'), '# pantoo-ai: per-person session state', ['context/session.md']);
    results.push({ what: '.gitignore', status: added ? 'updated' : 'unchanged' });
  }

  if (choices.share && !choices.local) {
    const snippet = readJson(path.join(kitRoot, 'settings', 'settings-snippet.json'), {});
    const merged = mergeSettings(path.join(dir, '.claude', 'settings.json'), {
      extraKnownMarketplaces: snippet.extraKnownMarketplaces,
      enabledPlugins: snippet.enabledPlugins,
    });
    results.push({ what: '.claude/settings.json', status: merged.added.length ? `merged: ${merged.added.join(', ')}` : 'unchanged' });
  }

  const companions = [...KINDS[choices.kind].companions];
  if (choices.kind === 'web-app' && found.shadcn) companions.push('ui-styling');
  const init = detect(dir).init;
  writeJson(path.join(dir, PROJECT_FILE), {
    layout: skipContext ? 1 : MANIFEST.layout,
    name: choices.name,
    kind: choices.kind,
    ui: choices.ui,
    existing: choices.existing,
    multiSurface: choices.multiSurface,
    local: choices.local,
    shared: Boolean(choices.share && !choices.local),
    companions,
    ...(init ? { init } : {}),
  });
  results.push({ what: PROJECT_FILE, status: 'added', note: companions.length ? `companions recorded: ${companions.join(', ')}` : '' });
  return results;
}
