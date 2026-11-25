import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptSettings, projectChecks, settingsCheck } from '../src/doctor.js';
import { profile } from '../src/paths.js';
import { scaffold } from '../src/scaffold.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-dr-'));
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); };
const SNIPPET = json(fileURLToPath(new URL('../../settings/settings-snippet.json', import.meta.url)));
const mine = { 'claude-opus-5-5': { effortLevel: 'medium' } };

// A profile with saved choices and a settings.json whose modelSettings differ from the kit's.
const machine = () => {
  const prof = profile(tmp());
  write(prof.configFile, { options: ['model-routing', 'no-attribution'] });
  write(path.join(prof.claudeDir, 'settings.json'), { env: SNIPPET.env, modelSettings: mine, attribution: SNIPPET.attribution });
  return prof;
};
const settings = (prof) => json(path.join(prof.claudeDir, 'settings.json'));

test('a settings difference warns and names --accept', () => {
  const prof = machine();
  const c = settingsCheck('modelSettings', settings(prof), SNIPPET);
  assert.equal(c.level, 'warn');
  assert.match(c.note, /doctor --accept modelSettings/);
});

test('--accept turns the warning to ok, and a new kit value warns again', () => {
  const prof = machine();
  const [r] = acceptSettings(prof, ['modelSettings']);
  assert.equal(r.status, 'saved');
  const { accepted } = json(prof.configFile);
  assert.deepEqual(json(prof.configFile).options, ['model-routing', 'no-attribution']);
  assert.deepEqual(settingsCheck('modelSettings', settings(prof), SNIPPET, accepted), { level: 'ok', what: 'settings.json modelSettings', note: 'yours, accepted' });
  const newKit = { ...SNIPPET, modelSettings: { ...SNIPPET.modelSettings, 'claude-fable-5-2': { effortLevel: 'high' } } };
  const again = settingsCheck('modelSettings', settings(prof), newKit, accepted);
  assert.equal(again.level, 'warn');
  assert.match(again.note, /kit value changed since you accepted/);
});

test('--accept refuses keys the kit does not manage, and skips a key that matches', () => {
  const prof = machine();
  assert.throws(() => acceptSettings(prof, ['permissions']), /manages env, modelSettings, attribution/);
  assert.deepEqual(acceptSettings(prof, ['attribution']).map((r) => r.status), ['not needed']);
  assert.equal(json(prof.configFile).accepted, undefined);
  assert.throws(() => acceptSettings(profile(tmp()), ['modelSettings']), /run `npx pantoo-ai init` first/);
});

test('v1 files left in a v2 context are named, not reported as a layout mismatch', () => {
  const dir = tmp();
  scaffold(dir, { name: 'demo', kind: 'backend', ui: false, existing: false, multiSurface: false, local: false, share: false });
  fs.mkdirSync(path.join(dir, 'context', 'plans'));
  const layout = projectChecks(dir, profile(tmp())).find((c) => c.what === 'context layout');
  assert.equal(layout.level, 'warn');
  assert.equal(layout.note, 'v1 files left: context/plans/; /pantoo:start-project moves them');
});

test('a shadcn project still on ui-styling is pointed at the official shadcn skill', () => {
  const dir = tmp();
  scaffold(dir, { name: 'demo', kind: 'web-app', ui: true, existing: false, multiSurface: false, local: false, share: false });
  const record = json(path.join(dir, '.pantoo.json'));
  write(path.join(dir, '.pantoo.json'), { ...record, companions: [...record.companions, 'ui-styling'] });
  const prof = profile(tmp());
  const note = (checks) => checks.filter((c) => c.what === 'companion ui-styling' && /official `shadcn` skill/.test(c.note));
  assert.equal(note(projectChecks(dir, prof)).length, 0, 'no components.json, no note');
  fs.writeFileSync(path.join(dir, 'components.json'), '{}');
  const [row] = note(projectChecks(dir, prof));
  assert.equal(row.level, 'warn');
});
