// Reads a project's intake state and prints labelled lines, so the mode isn't judged from raw greps.
// Usage: node state.mjs [projectDir]   (run by start-project step 1)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] ?? '.');
const templates = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'templates');

// Same rule as `doctor`: a security.md without a `Rules: vN` line predates it, so it's v1.
export const rulesVersion = (text) => Number(text.match(/^Rules: v(\d+)/m)?.[1] ?? 1);
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

const walk = (p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).flatMap((n) => walk(path.join(p, n))) : [p]);
// A placeholder is `{{NAME}}` closed on the same line. `{{TBD: …}}` is a recorded unknown; `{{ ` is
// code (JSX) and a `{{` followed by a quote or backtick is text about placeholders.
export const PLACEHOLDER = /\{\{(?!TBD|[\s`'"])[^{}\n]*\}\}/;

export function state(dir) {
  const ctx = path.join(dir, 'context');
  const hasCtx = fs.existsSync(ctx);
  const layout = fs.existsSync(path.join(ctx, 'roadmap.md')) ? 'v2' : hasCtx ? 'v1' : 'none';
  // Old paths still there next to a v2 context (as `doctor` reports them): migrate moves them.
  const manifest = JSON.parse(read(path.join(templates, 'manifest.json')) ?? '{}');
  const leftovers = layout === 'v2' ? Object.keys(manifest.v1 ?? {}).filter((rel) => rel.startsWith('context/') && fs.existsSync(path.join(dir, rel))) : [];
  const sec = read(path.join(ctx, 'security.md'));
  const kit = rulesVersion(read(path.join(templates, 'context', 'security.md')));
  const proj = sec === null ? null : rulesVersion(sec);
  const files = [...(hasCtx ? walk(ctx) : []), ...['AGENTS.md', 'CLAUDE.md', 'CLAUDE.local.md'].map((f) => path.join(dir, f)).filter(fs.existsSync)]
    .filter((f) => f.endsWith('.md') && path.basename(f) !== 'roadmap.md');
  const placeholders = files.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n')
    .map((l, i) => (PLACEHOLDER.test(l) ? `${path.relative(dir, f)}:${i + 1}: ${l.trim().slice(0, 100)}` : null)).filter(Boolean));
  const oldRules = proj !== null && proj < kit;
  // Same rule as `doctor`: a UI project owes a copy.md, an automation project an automations.md,
  // as `.pantoo.json` records them.
  let record = {};
  try { record = JSON.parse(read(path.join(dir, '.pantoo.json')) ?? '{}') ?? {}; } catch { /* unreadable: don't ask */ }
  const missingCopy = layout === 'v2' && record.ui === true && !fs.existsSync(path.join(ctx, 'copy.md'));
  const missingAutomations = layout === 'v2' && record.kind === 'automation' && !fs.existsSync(path.join(ctx, 'automations.md'));
  const finished = placeholders.length ? 'resume' : missingCopy ? 'add copy' : missingAutomations ? 'add automations' : 'done';
  const mode = layout === 'v1' || leftovers.length ? 'migrate' : layout === 'v2' ? (oldRules ? 'update rules' : finished) : 'scaffold';
  return { layout, leftovers, rules: { project: proj, kit }, placeholders, missingCopy, missingAutomations, mode };
}

// Node realpaths the module URL, so compare real paths: the plugin dir may be reached through a symlink.
const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  const s = state(root);
  console.log(`context layout: ${s.layout}`);
  if (s.leftovers.length) console.log(`v1 files left: ${s.leftovers.join(', ')}`);
  console.log(`security rules: project ${s.rules.project === null ? 'none (no security.md)' : 'v' + s.rules.project}, kit v${s.rules.kit}`);
  console.log(`placeholder lines: ${s.placeholders.length ? '\n  ' + s.placeholders.join('\n  ') : 'none'}`);
  if (s.placeholders.length) console.log('(text that only talks about a placeholder check is not an unfilled placeholder)');
  if (s.missingCopy) console.log('context/copy.md: missing (UI project)');
  if (s.missingAutomations) console.log('context/automations.md: missing (automation project)');
  console.log(`mode: ${s.mode}`);
}
