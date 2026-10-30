#!/usr/bin/env node
// Lints the kit: skill frontmatter and budgets, links, portability, agents, versions, hooks.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const fail = (p, msg) => problems.push(`${rel(p)}: ${msg}`);
const read = (p) => fs.readFileSync(p, 'utf8');
const isDir = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();

function walk(dir) {
  if (!isDir(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const lineCount = (text) => text.replace(/\n$/, '').split('\n').length;

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const k = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (k) fm[k[1]] = k[2].trim();
  }
  return { fm, end: m[0].length };
}

const skillsDir = path.join(root, 'plugin/skills');
const skills = isDir(skillsDir) ? fs.readdirSync(skillsDir).filter((d) => isDir(path.join(skillsDir, d))) : [];

for (const dir of skills) {
  const base = path.join(skillsDir, dir);
  const file = path.join(base, 'SKILL.md');
  if (!fs.existsSync(file)) { fail(base, 'missing SKILL.md'); continue; }
  const text = read(file);
  const parsed = frontmatter(text);
  if (!parsed) fail(file, 'missing frontmatter');
  else {
    const { fm } = parsed;
    if (fm.name !== dir) fail(file, `name "${fm.name ?? ''}" must equal folder "${dir}"`);
    if (!/^[a-z]+(-[a-z]+)+$/.test(dir)) fail(file, 'name must be verb-noun (lowercase, 2+ hyphen-separated words)');
    if (!fm.description) fail(file, 'empty or missing description');
    for (const key of ['model', 'allowed-tools']) if (key in fm) fail(file, `frontmatter must not set ${key}`);
    if (!/^Recommended:/m.test(text.slice(parsed.end))) fail(file, 'no line starting with "Recommended:"');
  }
  if (lineCount(text) > 120) fail(file, `${lineCount(text)} lines, budget is 120`);
  for (const sub of ['references', 'modes']) {
    for (const f of walk(path.join(base, sub))) {
      const n = lineCount(read(f));
      if (n > 200) fail(f, `${n} lines, budget is 200`);
    }
  }
  for (const f of walk(base).filter((p) => p.endsWith('.md'))) {
    for (const m of read(f).matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1].split('#')[0];
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      if (!fs.existsSync(path.resolve(path.dirname(f), target))) fail(f, `broken link ${m[1]}`);
    }
  }
}

const PORTABILITY = [/\/Users\//, /\/home\/[A-Za-z]/, /C:\\/, /~\/Documents/, /Pantoo Solutions\//];
for (const top of ['plugin', 'rules', 'agents-user', 'docs']) {
  for (const f of walk(path.join(root, top))) {
    let text;
    try { text = read(f); } catch { continue; }
    if (text.includes('\0')) continue;
    text.split(/\r?\n/).forEach((line, i) => {
      const re = PORTABILITY.find((r) => r.test(line));
      if (re) fail(f, `line ${i + 1}: machine-specific path (${line.match(re)[0]})`);
    });
  }
}

for (const dir of ['plugin/agents', 'agents-user']) {
  const abs = path.join(root, dir);
  if (!isDir(abs)) continue;
  for (const name of fs.readdirSync(abs).filter((n) => n.endsWith('.md'))) {
    const f = path.join(abs, name);
    const parsed = frontmatter(read(f));
    const stem = name.slice(0, -3);
    if (!parsed) fail(f, 'missing frontmatter');
    else if (parsed.fm.name !== stem) fail(f, `name "${parsed.fm.name ?? ''}" must equal filename "${stem}"`);
  }
}

const readJson = (p) => {
  try { return JSON.parse(read(p)); } catch (e) { fail(p, `cannot parse: ${e.message}`); return null; }
};
const pkg = readJson(path.join(root, 'package.json'));
const plug = readJson(path.join(root, 'plugin/.claude-plugin/plugin.json'));
if (pkg && plug && pkg.version !== plug.version) {
  fail(path.join(root, 'plugin/.claude-plugin/plugin.json'), `version ${plug.version} differs from package.json ${pkg.version}`);
}

const hooksFile = path.join(root, 'plugin/hooks/hooks.json');
if (fs.existsSync(hooksFile)) {
  const hooks = readJson(hooksFile);
  if (hooks) {
    if (!hooks.hooks || typeof hooks.hooks !== 'object' || Array.isArray(hooks.hooks)) fail(hooksFile, 'needs a top-level "hooks" object');
    for (const m of JSON.stringify(hooks).matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"\s]+)/g)) {
      if (!fs.existsSync(path.join(root, 'plugin', m[1]))) fail(hooksFile, `missing file ${m[1]}`);
    }
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`check-skills: ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log(`check-skills: ${skills.length} skills, all good`);
