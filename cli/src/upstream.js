import { newer } from './self-update.js';
import { TOOLS, pinLabel, pinOf, readHolds } from './third-party.js';

// `update --check`: what each design tool is pinned to, and the newest upstream has. It only reads.
// Whatever upstream sends is matched against a strict pattern before it is printed.

const VERSION = /^\d+\.\d+\.\d+$/;
const SHA = /^[0-9a-f]{40}$/;

// GitHub through `gh` when it's logged in (a higher rate limit), else anonymous HTTPS.
function github(run, get, env) {
  const loggedIn = run('gh', ['auth', 'status'], { env }).ok;
  return async (path) => {
    if (loggedIn) {
      const r = run('gh', ['api', path], { env });
      if (r.ok) {
        try { return JSON.parse(r.out); } catch { /* ask over HTTPS instead */ }
      }
    }
    const res = await get(`https://api.github.com/${path}`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'pantoo-ai' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    return res.json();
  };
}

// The highest x.y.z among the tags that are `prefix` + a version; pre-releases don't count.
async function newestTag(api, repo, prefix) {
  const refs = await api(`repos/${repo}/git/matching-refs/tags/${prefix}`);
  const versions = refs.map((r) => String(r.ref).slice(`refs/tags/${prefix}`.length)).filter((v) => VERSION.test(v));
  if (!versions.length) throw new Error(`no ${prefix} tag found`);
  return versions.reduce((best, v) => (newer(v, best) ? v : best));
}

// A tool pinned to a branch commit ("main@<sha>") is compared with the default branch's head.
async function checkCommit(api, tool) {
  const { sha } = await api(`repos/${tool.repo}/commits/HEAD`);
  if (!SHA.test(sha)) throw new Error('no commit found');
  return sha === tool.sha
    ? { level: 'ok', note: 'upstream is at the pin' }
    : { level: 'warn', note: `upstream has moved to ${tool.tag.split('@')[0]}@${sha.slice(0, 7)}` };
}

async function checkTag(api, tool) {
  // "skill-v4.11.0" is the prefix "skill-v" and the version "4.11.0".
  const [, prefix, pinned] = tool.tag.match(/^(.*?v)(\d+\.\d+\.\d+)$/);
  const latest = await newestTag(api, tool.repo, prefix);
  return newer(latest, pinned)
    ? { level: 'warn', note: `upstream has ${prefix}${latest}` }
    : { level: 'ok', note: `newest upstream tag is ${prefix}${latest}` };
}

// impeccable's npm package is only the installer, so its version is shown beside the skill's tag.
function npmLatest(spec, run, env) {
  const r = run('npm', ['view', spec.slice(0, spec.lastIndexOf('@')), 'version'], { env });
  const version = r.ok && r.out.split('\n').map((l) => l.trim()).find((l) => VERSION.test(l));
  return `npm installer ${version || 'not checked'}`;
}

export async function checkUpstream({ prof, run, fetch: get }) {
  const api = github(run, get, prof.env);
  const holds = readHolds(prof);
  const rows = [];
  for (const [id, tool] of Object.entries(TOOLS)) {
    const held = Object.hasOwn(holds, id) ? `, held at ${pinLabel(id, holds[id])}` : '';
    const what = `${id}: pinned ${pinLabel(id, pinOf(id))}${held}`;
    try {
      const found = await (tool.tag.includes('@') ? checkCommit(api, tool) : checkTag(api, tool));
      if (tool.via === 'npm') found.note += `; ${npmLatest(tool.npm, run, prof.env)}`;
      rows.push({ what, ...found });
    } catch (err) {
      rows.push({ what, level: 'warn', note: `could not check upstream (${String(err.message).split('\n')[0]})` });
    }
  }
  return rows;
}
