import fs from 'node:fs';
import path from 'node:path';
import { kitRoot } from './paths.js';
import { spawn } from './spawn.js';
import { readJson } from './files.js';

export const VERSION = readJson(path.join(kitRoot, 'package.json'), {}).version ?? '0.0.0';
const REGISTRY = 'https://registry.npmjs.org/pantoo-ai/latest';

const parts = (v) => String(v).split('-')[0].split('.').map((n) => Number(n) || 0);
export function newer(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

const npx = (args, env) => {
  const r = spawn('npx', args, { stdio: 'inherit', env });
  return r.error ? null : r.status ?? 1;
};
const VERSION_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

// If npm has a newer CLI, re-runs `update` through it. Returns the child's exit code, or null to carry on (also when npx can't start).
export async function selfUpdate({
  args, env = process.env, version = VERSION, isClone = fs.existsSync(path.join(kitRoot, '.git')),
  fetch: get = globalThis.fetch, run = npx, warn = console.warn,
}) {
  if (env.PANTOO_AI_NO_SELF_UPDATE || args.includes('--no-self-update') || isClone) return null;
  let latest;
  try {
    const res = await get(REGISTRY, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    latest = (await res.json()).version;
    if (typeof latest !== 'string' || !VERSION_RE.test(latest)) throw new Error('no version');
  } catch {
    warn('! could not check npm for a newer pantoo-ai; continuing with this version');
    return null;
  }
  if (!newer(latest, version)) return null;
  console.log(`pantoo-ai ${latest} is out (this is ${version}); running update with it.`);
  const code = run(['--yes', `pantoo-ai@${latest}`, 'update', ...args], { ...env, PANTOO_AI_NO_SELF_UPDATE: '1' });
  if (code === null) warn(`! could not run pantoo-ai@${latest}; continuing with this version`);
  return code;
}
