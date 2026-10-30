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
