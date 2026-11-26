import fs from 'node:fs';
import { PLUGIN } from './install.js';
import { nodeAtLeast } from './node-version.js';

// Claude Code's auto-update moves only the user-scope install of the plugin. A project-scope install
// stays at the version it was installed at, so `update` and `doctor` find them in
// `claude plugin list --json`, which lists every project's install with its `projectPath`.

// The list as `defaultRun` returns it, stdout and stderr together: read the JSON array only.
export function parsePlugins(out) {
  const start = out.indexOf('[');
  try {
    const list = JSON.parse(out.slice(start, out.lastIndexOf(']') + 1));
    return start >= 0 && Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const ours = (p) => p.id === PLUGIN || p.name === 'pantoo';
const SEMVER = /^\d+\.\d+\.\d+$/;
const semver = (v) => typeof v === 'string' && SEMVER.test(v);

// The version a project install should be at: the user-scope install's, else the newest one seen.
export function latestVersion(plugins) {
  const mine = plugins.filter((p) => ours(p) && semver(p.version));
  const user = mine.find((p) => p.scope === 'user');
  if (user) return user.version;
  return mine.map((p) => p.version).reduce((a, v) => (!a || !nodeAtLeast(a, v) ? v : a), null);
}

// Project installs behind `latest`, and the ones whose folder is gone (left alone: Claude Code
// can only uninstall a project install from inside its folder).
export function staleProjects(plugins, exists = fs.existsSync) {
  const latest = latestVersion(plugins);
  const project = plugins.filter((p) => ours(p) && p.scope === 'project' && typeof p.projectPath === 'string');
  return {
    latest,
    behind: latest ? project.filter((p) => semver(p.version) && !nodeAtLeast(p.version, latest) && exists(p.projectPath)) : [],
    gone: project.filter((p) => !exists(p.projectPath)),
  };
}
