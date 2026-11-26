import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectPluginChecks } from '../src/doctor.js';
import { install } from '../src/install.js';
import { update } from '../src/manage.js';
import { profile } from '../src/paths.js';
import { latestVersion, parsePlugins, staleProjects } from '../src/project-plugins.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-pp-'));
const entry = (scope, version, projectPath) => ({ id: 'pantoo@pantoo-ai', scope, version, ...(projectPath ? { projectPath } : {}) });

test('parsePlugins reads the array past stderr noise, and gives [] for anything else', () => {
  const list = [entry('user', '0.9.1')];
  assert.deepEqual(parsePlugins(`warning: something\n${JSON.stringify(list)}\n`), list);
  assert.deepEqual(parsePlugins(''), []);
  assert.deepEqual(parsePlugins('not json'), []);
  assert.deepEqual(parsePlugins('{"a":1}'), []);
});

test('latestVersion is the user install, else the newest, ignoring other plugins and odd versions', () => {
  assert.equal(latestVersion([entry('project', '0.9.1', '/a'), entry('user', '0.9.0')]), '0.9.0');
  assert.equal(latestVersion([entry('project', '0.8.0', '/a'), entry('project', '0.10.0', '/b'), entry('project', 'abc', '/c')]), '0.10.0');
  assert.equal(latestVersion([{ id: 'other@x', scope: 'user', version: '9.0.0' }]), null);
});

test('staleProjects finds installs behind the user one, and folders that are gone', () => {
  const here = tmp();
  const ahead = tmp();
  const list = [
    entry('user', '0.9.1'),
    entry('project', '0.8.0', here),
    entry('project', '0.9.1', tmp()),
    entry('project', '0.10.0', ahead),
    entry('project', '0.8.0', path.join(here, 'gone')),
    { id: 'other@x', scope: 'project', version: '0.1.0', projectPath: here },
  ];
  const { latest, behind, gone } = staleProjects(list);
  assert.equal(latest, '0.9.1');
  assert.deepEqual(behind.map((p) => p.projectPath), [here]);
  assert.deepEqual(gone.map((p) => p.projectPath), [path.join(here, 'gone')]);
});

test('doctor warns once per project install behind the user one', () => {
  const a = tmp();
  const rows = projectPluginChecks([entry('user', '0.9.1'), entry('project', '0.8.0', a), entry('project', '0.9.1', tmp())]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].level, 'warn');
  assert.equal(rows[0].what, `plugin pantoo@pantoo-ai (project ${path.basename(a)})`);
  assert.match(rows[0].note, /0\.8\.0, behind 0\.9\.1; run `npx pantoo-ai update`/);
  assert.deepEqual(projectPluginChecks([entry('user', '0.9.1')]), []);
});

test('update runs the plugin update inside each project behind, and skips gone folders', () => {
  const prof = profile(tmp());
  const dir = tmp();
  spawnSync('git', ['init', '-q', dir]);
  const behind = tmp();
  const gone = path.join(tmp(), 'gone');
  const list = [entry('user', '0.9.1'), entry('project', '0.8.0', behind), entry('project', '0.9.1', tmp()), entry('project', '0.8.0', gone)];
  const calls = [];
  const run = (cmd, args, o = {}) => {
    calls.push({ cmd, args, ...o });
    return { ok: true, out: args.join(' ') === 'plugin list --json' ? JSON.stringify(list) : '' };
  };
  install({ prof, scope: 'user', dir, options: [], run });
  calls.length = 0;
  const results = update({ prof, dir, run });
  const projectUpdates = calls.filter((c) => c.args.join(' ') === 'plugin update pantoo@pantoo-ai --scope project');
  assert.deepEqual(projectUpdates.map((c) => c.cwd), [behind]);
  assert.ok(results.some((r) => r.what === `plugin pantoo@pantoo-ai (project ${path.basename(behind)})` && r.status === 'updated' && r.note === 'was 0.8.0'));
  assert.ok(results.some((r) => r.status === 'skipped' && r.note.includes(gone)));
});

test('update adds nothing when the plugin list cannot be read', () => {
  const prof = profile(tmp());
  const dir = tmp();
  spawnSync('git', ['init', '-q', dir]);
  const run = (cmd, args) => ({ ok: args.join(' ') !== 'plugin list --json', out: '' });
  install({ prof, scope: 'user', dir, options: [], run });
  const results = update({ prof, dir, run });
  assert.ok(!results.some((r) => r.what.includes('(project')));
});
