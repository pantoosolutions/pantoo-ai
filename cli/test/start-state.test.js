import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { state } from '../../plugin/skills/start-project/scripts/state.mjs';

const project = (security) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-'));
  fs.mkdirSync(path.join(dir, 'context'));
  fs.writeFileSync(path.join(dir, 'context', 'roadmap.md'), '# Roadmap\n');
  fs.writeFileSync(path.join(dir, 'context', 'security.md'), security);
  return dir;
};

test('a security.md without a Rules line is v1 and gets the update-rules mode', () => {
  const s = state(project('# Security Rules\n\nno version here\n'));
  assert.equal(s.rules.project, 1);
  assert.ok(s.rules.kit >= 2);
  assert.equal(s.mode, 'update rules');
});

test('a security.md on the kit version is done', () => {
  const kit = state(project('Rules: v1\n')).rules.kit;
  const s = state(project(`# Security Rules\nRules: v${kit} (x)\n`));
  assert.equal(s.rules.project, kit);
  assert.equal(s.mode, 'done');
});

import { PLACEHOLDER } from '../../plugin/skills/start-project/scripts/state.mjs';

test('placeholders: unfilled ones match, text about them does not', () => {
  for (const yes of ['| KI-01 | {{SHORT_TITLE}} | {{AREA}} |', 'Name: {{path:line}}']) assert.ok(PLACEHOLDER.test(yes), yes);
  for (const no of ['the build fails on `{{` placeholders', '{{TBD: founders review}}', 'render {{ value }} here', 'any `{{` remains']) assert.ok(!PLACEHOLDER.test(no), no);
});

test('an unanswered placeholder in CLAUDE.local.md resumes the intake', () => {
  const dir = project('Rules: v99\n');
  fs.writeFileSync(path.join(dir, 'CLAUDE.local.md'), '{{EXCEPTIONS}}\n');
  const s = state(dir);
  assert.deepEqual(s.placeholders, ['CLAUDE.local.md:1: {{EXCEPTIONS}}']);
  assert.equal(s.mode, 'resume');
});

test('a finished UI project without copy.md gets the add-copy mode', () => {
  const dir = project('Rules: v99\n');
  fs.writeFileSync(path.join(dir, '.pantoo.json'), '{"ui":true}');
  assert.equal(state(dir).mode, 'add copy');
  fs.writeFileSync(path.join(dir, 'context', 'copy.md'), '# Copy\n');
  assert.equal(state(dir).mode, 'done');
});

test('a project without a UI owes no copy.md', () => {
  const dir = project('Rules: v99\n');
  fs.writeFileSync(path.join(dir, '.pantoo.json'), '{"ui":false}');
  assert.equal(state(dir).mode, 'done');
});

test('a finished automation project without automations.md gets the add-automations mode', () => {
  const dir = project('Rules: v99\n');
  fs.writeFileSync(path.join(dir, '.pantoo.json'), '{"kind":"automation","ui":false}');
  assert.equal(state(dir).mode, 'add automations');
  fs.writeFileSync(path.join(dir, 'context', 'automations.md'), '# Automations\n');
  assert.equal(state(dir).mode, 'done');
});

test('v1 files left next to a v2 context pick the migrate mode', () => {
  const dir = project('Rules: v99\n');
  fs.mkdirSync(path.join(dir, 'context', 'plans'));
  const s = state(dir);
  assert.deepEqual(s.leftovers, ['context/plans/']);
  assert.equal(s.mode, 'migrate');
});

test('the plugin ships the same repo settings that `new --share` writes', () => {
  const json = (rel) => JSON.parse(fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8'));
  const { extraKnownMarketplaces, enabledPlugins } = json('settings/settings-snippet.json');
  assert.deepEqual(json('plugin/templates/claude-settings.json'), { extraKnownMarketplaces, enabledPlugins });
});
