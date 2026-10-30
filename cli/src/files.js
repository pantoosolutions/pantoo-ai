import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Line endings don't count as a change: a Windows clone (core.autocrlf) checks kit files out with CRLF.
export const lf = (text) => text.replace(/\r\n/g, '\n');
export const sameText = (a, b) => a !== null && b !== null && lf(a) === lf(b);

export const hash = (text) => crypto.createHash('sha256').update(lf(text)).digest('hex');

export const readIfExists = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);

export const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export function backup(file) {
  const copy = `${file}.bak-${stamp()}`;
  fs.copyFileSync(file, copy);
  return copy;
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
