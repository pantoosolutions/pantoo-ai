import { backup, readJson, writeJson } from './files.js';
import fs from 'node:fs';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Adds what is missing and keeps every value the user already has.
// Returns the merged object plus what was added and what was kept over the kit's value.
export function merge(existing, snippet, prefix = '') {
  const out = { ...existing };
  const added = [];
  const kept = [];
  for (const [key, value] of Object.entries(snippet)) {
    const at = prefix + key;
    if (!(key in existing)) {
      out[key] = value;
      added.push(at);
    } else if (isObject(value) && isObject(existing[key])) {
      const inner = merge(existing[key], value, `${at}.`);
      out[key] = inner.out;
      added.push(...inner.added);
      kept.push(...inner.kept);
    } else if (JSON.stringify(existing[key]) !== JSON.stringify(value)) {
      kept.push(at);
    }
  }
  return { out, added, kept };
}

export function mergeSettings(file, snippet) {
  const existed = fs.existsSync(file);
  const { out, added, kept } = merge(readJson(file, {}), snippet);
  let backupFile = null;
  if (added.length) {
    if (existed) backupFile = backup(file);
    writeJson(file, out);
  }
  return { added, kept, backupFile };
}

// Mirror of `merge`: removes only the values that still equal the kit's, prunes objects it
// emptied, and keeps anything the user changed. With `only` (paths the kit added), nothing else is touched. Returns the result plus removed and kept paths.
export function unmerge(existing, snippet, prefix = '', only = null) {
  const out = { ...existing };
  const removed = [];
  const kept = [];
  for (const [key, value] of Object.entries(snippet)) {
    const at = prefix + key;
    if (!(key in existing)) continue;
    if (only && !isObject(value) && !only.has(at)) continue;
    if (isObject(value) && isObject(existing[key])) {
      const inner = unmerge(existing[key], value, `${at}.`, only?.has(at) ? null : only);
      removed.push(...inner.removed);
      kept.push(...inner.kept);
      if (inner.removed.length && !Object.keys(inner.out).length) delete out[key];
      else out[key] = inner.out;
    } else if (JSON.stringify(existing[key]) === JSON.stringify(value)) {
      delete out[key];
      removed.push(at);
    } else {
      kept.push(at);
    }
  }
  return { out, removed, kept };
}

export function unmergeSettings(file, snippet, only = null) {
  if (!fs.existsSync(file)) return { removed: [], kept: [], backupFile: null };
  const { out, removed, kept } = unmerge(readJson(file, {}), snippet, '', only && new Set(only));
  let backupFile = null;
  if (removed.length) {
    backupFile = backup(file);
    writeJson(file, out);
  }
  return { removed, kept, backupFile };
}
