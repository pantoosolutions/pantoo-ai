import test from 'node:test';
import assert from 'node:assert/strict';
import { merge } from '../src/settings.js';

test('adds missing keys and keeps existing values', () => {
  const existing = { model: 'opus', env: { A: '1', CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' } };
  const snippet = { env: { CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet', B: '2' }, attribution: { commit: '' } };
  const { out, added, kept } = merge(existing, snippet);
  assert.deepEqual(out.env, { A: '1', CLAUDE_CODE_SUBAGENT_MODEL: 'haiku', B: '2' });
  assert.equal(out.model, 'opus');
  assert.deepEqual(out.attribution, { commit: '' });
  assert.deepEqual(added, ['env.B', 'attribution']);
  assert.deepEqual(kept, ['env.CLAUDE_CODE_SUBAGENT_MODEL']);
});

test('is a no-op when everything is present', () => {
  const s = { a: { b: 1 } };
  assert.deepEqual(merge(s, s).added, []);
});

test('unmerge removes only kit-equal values and prunes emptied objects', async () => {
  const { unmerge } = await import('../src/settings.js');
  const snippet = { env: { CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet' }, attribution: { commit: '', pr: '' }, modelSettings: { a: { effortLevel: 'high' } } };
  const existing = { model: 'opus', env: { CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet' }, attribution: { commit: '', pr: 'mine' }, modelSettings: { a: { effortLevel: 'low' } } };
  const { out, removed, kept } = unmerge(existing, snippet);
  assert.deepEqual(out, { model: 'opus', attribution: { pr: 'mine' }, modelSettings: { a: { effortLevel: 'low' } } });
  assert.deepEqual(removed, ['env.CLAUDE_CODE_SUBAGENT_MODEL', 'attribution.commit']);
  assert.deepEqual(kept, ['attribution.pr', 'modelSettings.a.effortLevel']);
});
