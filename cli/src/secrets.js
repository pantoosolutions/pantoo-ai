import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './files.js';
import { PROJECT_FILE } from './scaffold.js';
import { git } from './spawn.js';

// D32: the secrets a project expects, from .pantoo.json. The file comes with a clone, so it's
// untrusted: nothing here runs a command from it, and no value is ever opened or printed.

const NAME = /^[\w .-]{1,64}$/;
const ENV = /^[A-Z_][A-Z0-9_]*$/;
// Control and invisible format characters (escape sequences, right-to-left overrides, zero-width):
// they can make a terminal show something other than the text.
export const HIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
// Text from the file that reaches the terminal.
export const plain = (text, max = 200) => String(text).replace(new RegExp(HIDDEN, 'gu'), ' ').slice(0, max);

const inside = (base, abs) => {
  const rel = path.relative(base, abs);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

// One `file` value: `~/…` under home, a relative path under the project. Anything else is null.
function resolveFile(value, { root, home }) {
  if (typeof value !== 'string' || !value || value.includes('\0')) return null;
  const f = value.replace(/\\/g, '/');
  if (f.startsWith('~/')) {
    const abs = path.resolve(home, f.slice(2));
    return inside(home, abs) ? { written: value, abs, project: null } : null;
  }
  if (f.startsWith('/') || f.startsWith('~') || /^[A-Za-z]:/.test(f)) return null;
  const abs = path.resolve(root, f);
  return inside(root, abs) ? { written: value, abs, project: path.relative(root, abs).split(path.sep).join('/') } : null;
}

// Returns { secrets: [{ name, env, files, note }], warns: [check rows] }.
export function validSecrets(record, { root, home }) {
  const secrets = [];
  const warns = [];
  const list = Array.isArray(record?.secrets) ? record.secrets : [];
  if (record?.secrets !== undefined && !Array.isArray(record.secrets)) warns.push({ level: 'warn', what: `${PROJECT_FILE} secrets`, note: 'not a list; ignored' });
  list.forEach((entry, i) => {
    const label = typeof entry?.name === 'string' && NAME.test(entry.name) ? entry.name : null;
    const what = label ? `secret ${label}` : `${PROJECT_FILE} secrets[${i}]`;
    if (!label) return warns.push({ level: 'warn', what, note: 'needs a name of up to 64 letters, digits, spaces, . _ or -; ignored' });
    const out = { name: label, env: null, files: [], note: typeof entry.note === 'string' ? plain(entry.note) : '' };
    if (entry.env !== undefined) {
      if (typeof entry.env === 'string' && ENV.test(entry.env)) out.env = entry.env;
      else warns.push({ level: 'warn', what, note: 'env must be a variable name like API_TOKEN; ignored' });
    }
    const files = entry.file === undefined ? [] : [entry.file].flat();
    for (const f of files) {
      const resolved = resolveFile(f, { root, home });
      if (resolved) out.files.push(resolved);
      else warns.push({ level: 'warn', what, note: `file "${plain(f, 80)}" dropped: use ~/… or a path inside the project` });
    }
    if (!out.env && !out.files.length) return warns.push({ level: 'warn', what, note: 'no usable env or file; ignored' });
    secrets.push(out);
  });
  return { secrets, warns };
}

// One row per secret: present (env set, or any file there), missing, or committed.
// Files are only stat-ed, never opened.
export function secretChecks(dir, prof, env = process.env) {
  const record = readJson(path.join(dir, PROJECT_FILE), null);
  const { secrets, warns } = validSecrets(record, { root: dir, home: prof.home });
  const checks = [...warns];
  for (const s of secrets) {
    const what = `secret ${s.name}`;
    const committed = s.files.find((f) => f.project && git(dir, ['ls-files', '--', f.project], { cwd: prof.home }).out.trim());
    if (committed) {
      checks.push({ level: 'fail', what, note: `${plain(committed.written)} is committed: rotate it, then \`git rm --cached ${plain(committed.project)}\` and ignore it` });
      continue;
    }
    const fromEnv = s.env && typeof env[s.env] === 'string' && env[s.env] !== '';
    const file = s.files.find((f) => fs.statSync(f.abs, { throwIfNoEntry: false }));
    if (fromEnv || file) {
      checks.push({ level: 'ok', what, note: fromEnv ? `env ${s.env}` : plain(file.written) });
      continue;
    }
    const where = [s.env && `set ${s.env}`, s.files.length && `create ${s.files.map((f) => plain(f.written)).join(' or ')}`].filter(Boolean).join(', or ');
    checks.push({ level: 'warn', what, note: `missing: ${where}${s.note ? `; ${s.note}` : ''}` });
  }
  return checks;
}
