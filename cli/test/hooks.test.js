import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findAttribution } from '../../plugin/hooks/scripts/commit-guard.mjs';

const scripts = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../plugin/hooks/scripts');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pantoo-hook-'));

function run(script, input, env = {}) {
  const r = spawnSync(process.execPath, [path.join(scripts, script)], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_OPTION_COMMIT_GUARD: '', CLAUDE_PROJECT_DIR: '', ...env },
  });
  return { status: r.status, out: r.stdout.trim() };
}
const bash = (command, cwd = process.cwd()) => ({ tool_input: { command }, cwd });
const dirty = 'git commit -m "feat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"';

test('findAttribution hits each pattern', () => {
  assert.equal(findAttribution('Co-authored-by: Claude Opus <x@y.z>').length > 0, true);
  assert.equal(findAttribution('Co-Authored-By: Anthropic').length > 0, true);
  assert.equal(findAttribution('mail noreply@anthropic.com').length, 1);
  assert.equal(findAttribution('Generated with Claude Code').length, 1);
  assert.equal(findAttribution('Generated with [Claude Code](https://claude.com/claude-code)').length, 1);
  assert.equal(findAttribution('done \u{1F916}').length, 1);
  assert.equal(findAttribution('https://claude.ai/code/session_1').length, 1);
});

test('the guard still runs when the plugin dir is reached through a symlink', { skip: process.platform === 'win32' }, () => {
  const dir = tmp();
  const link = path.join(dir, 'linked');
  fs.symlinkSync(scripts, link, 'dir');
  const r = spawnSync(process.execPath, [path.join(link, 'commit-guard.mjs')], {
    input: JSON.stringify(bash(dirty)), encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_OPTION_COMMIT_GUARD: '' },
  });
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('findAttribution passes clean text', () => {
  assert.deepEqual(findAttribution('feat(cli): add doctor command\n\nCo-Authored-By: Jane <jane@x.com>'), []);
});

test('block mode denies', () => {
  const r = run('commit-guard.mjs', bash(dirty));
  assert.equal(r.status, 0);
  const o = JSON.parse(r.out).hookSpecificOutput;
  assert.equal(o.permissionDecision, 'deny');
  assert.match(o.permissionDecisionReason, /Co-Authored-By/);
});

test('unknown mode behaves as block', () => {
  const r = run('commit-guard.mjs', bash(dirty), { CLAUDE_PLUGIN_OPTION_COMMIT_GUARD: 'bogus' });
  assert.equal(JSON.parse(r.out).hookSpecificOutput.permissionDecision, 'deny');
});

test('warn mode adds context without a decision', () => {
  const r = run('commit-guard.mjs', bash(dirty), { CLAUDE_PLUGIN_OPTION_COMMIT_GUARD: 'warn' });
  const j = JSON.parse(r.out);
  assert.ok(j.systemMessage);
  assert.ok(j.hookSpecificOutput.additionalContext);
  assert.equal(j.hookSpecificOutput.permissionDecision, undefined);
});

test('off mode is silent', () => {
  const r = run('commit-guard.mjs', bash(dirty), { CLAUDE_PLUGIN_OPTION_COMMIT_GUARD: 'off' });
  assert.deepEqual(r, { status: 0, out: '' });
});

test('guards git -C commit, amend and gh pr create', () => {
  for (const c of ['git -C sub commit --amend -m "Generated with Claude Code"', 'gh pr create --body "\u{1F916} done"']) {
    assert.equal(JSON.parse(run('commit-guard.mjs', bash(c)).out).hookSpecificOutput.permissionDecision, 'deny', c);
  }
});

test('ignores other commands and clean commits', () => {
  for (const c of ['echo "Co-Authored-By: Claude"', 'git status', 'git commit -m "fix: typo"']) {
    assert.equal(run('commit-guard.mjs', bash(c)).out, '', c);
  }
});

test('scans message files resolved against cwd', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'msg.txt'), 'fix\n\nCo-Authored-By: Claude <x>');
  for (const c of ['git commit -F msg.txt', 'git commit --file=msg.txt', 'gh pr create --body-file msg.txt']) {
    assert.equal(JSON.parse(run('commit-guard.mjs', bash(c, dir)).out).hookSpecificOutput.permissionDecision, 'deny', c);
  }
  assert.equal(run('commit-guard.mjs', bash('git commit -F missing.txt', dir)).out, '');
  assert.equal(run('commit-guard.mjs', bash('git commit -F -', dir)).out, '');
});

test('malformed stdin is silent', () => {
  assert.deepEqual(run('commit-guard.mjs', 'not json'), { status: 0, out: '' });
  assert.deepEqual(run('commit-guard.mjs', '{}'), { status: 0, out: '' });
});

test('session reminder only when context/session.md exists', () => {
  const dir = tmp();
  assert.deepEqual(run('session-reminder.mjs', { cwd: dir }), { status: 0, out: '' });
  fs.mkdirSync(path.join(dir, 'context'));
  fs.writeFileSync(path.join(dir, 'context/session.md'), 'x');
  const r = run('session-reminder.mjs', { cwd: dir });
  const o = JSON.parse(r.out).hookSpecificOutput;
  assert.equal(o.hookEventName, 'SessionStart');
  assert.match(o.additionalContext, /context\/session\.md \(last saved \d{4}-\d\d-\d\d \d\d:\d\d local\)/);
  assert.match(o.additionalContext, /save-session resume/);
  assert.equal(run('session-reminder.mjs', { cwd: os.tmpdir() }, { CLAUDE_PROJECT_DIR: dir }).out !== '', true);
});
