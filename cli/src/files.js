import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { git } from './spawn.js';

// Line endings don't count as a change: a Windows clone (core.autocrlf) checks kit files out with CRLF.
export const lf = (text) => text.replace(/\r\n/g, '\n');
export const sameText = (a, b) => a !== null && b !== null && lf(a) === lf(b);

export const hash = (text) => crypto.createHash('sha256').update(lf(text)).digest('hex');

export const readIfExists = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);

export const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

// A backup can hold private state (env values, notes) under a name no ignore rule covers, so
// inside a git work tree it goes in .git/info/exclude.
export function backup(file) {
  const copy = `${file}.bak-${stamp()}`;
  fs.copyFileSync(file, copy);
  const dir = path.dirname(path.resolve(file));
  const [inside, prefix = ''] = git(dir, ['rev-parse', '--is-inside-work-tree', '--show-prefix']).out.split('\n');
  if (inside === 'true' && !git(dir, ['check-ignore', '-q', '--', path.basename(copy)]).ok) {
    excludeLocal(dir, [`/${globEscape(prefix + path.basename(file))}.bak-*`]);
  }
  return copy;
}

// A file name written into an ignore file stays that one name: no wildcard, no lost trailing space.
export const globEscape = (name) => name.replace(/[\\*?[]/g, '\\$&').replace(/ +$/, (s) => '\\ '.repeat(s.length));

export function appendLines(file, header, lines) {
  const current = readIfExists(file) ?? '';
  // A line break inside a line would add a second pattern.
  const missing = lines.filter((l) => !/[\r\n]/.test(l) && !current.split('\n').includes(l));
  if (!missing.length) return false;
  const sep = current && !current.endsWith('\n') ? '\n' : '';
  writeFile(file, `${current}${sep}${current ? '\n' : ''}${header}\n${missing.join('\n')}\n`);
  return true;
}

// Adds paths to .git/info/exclude. False when nothing was added or `dir` isn't a repo.
export function excludeLocal(dir, lines) {
  const r = git(dir, ['rev-parse', '--git-path', 'info/exclude']);
  if (!r.ok) return false;
  return appendLines(path.resolve(dir, r.out.trim()), '# pantoo-ai: local only, never commit', lines);
}

export function writeFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

export function readJson(file, fallback) {
  const text = readIfExists(file);
  if (text === null) return fallback;
  try {
    return JSON.parse(text.replace(/^\uFEFF/, '')); // Windows PowerShell 5.1 writes UTF-8 with a BOM
  } catch {
    throw new Error(`${file} is not valid JSON; fix or remove it, then run again.`);
  }
}

export const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
