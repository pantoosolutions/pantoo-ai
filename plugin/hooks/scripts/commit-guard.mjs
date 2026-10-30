// PreToolUse hook (Bash): stops AI attribution in commits, PRs and comments.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PATTERNS = [
  /co-authored-by:[^\n]*(?:claude|anthropic)/i,
  /noreply@anthropic\.com/i,
  /generated with[^\n]{0,60}claude/i,
  /\u{1F916}/u,
  /claude\.ai\/code/i,
];

const GIT_COMMIT = /\bgit\s+(?:[^|;&\n]*?\s)?commit\b/;
const GH_TEXT = /\bgh\s+(?:pr\s+(?:create|edit|comment)|issue\s+comment)\b/;
const FILE_FLAG = /(?:^|\s)(?:-F|--file|--body-file)(?:=|\s+)(?:"([^"]+)"|'([^']+)'|(\S+))/g;

export function findAttribution(text) {
  const hits = [];
  for (const re of PATTERNS) {
    const m = text.match(re);
    if (m) hits.push(m[0].trim());
  }
  return hits;
}

export function isGuardedCommand(command) {
  return GIT_COMMIT.test(command) || GH_TEXT.test(command);
}

function fileTexts(command, cwd) {
  const out = [];
  for (const m of command.matchAll(FILE_FLAG)) {
    const file = m[1] ?? m[2] ?? m[3];
    if (!file || file === '-') continue;
    try { out.push(fs.readFileSync(path.resolve(cwd || process.cwd(), file), 'utf8')); } catch { /* unreadable: skip */ }
  }
  return out;
}

export function decide(input, mode) {
  const command = input?.tool_input?.command;
  if (mode === 'off' || typeof command !== 'string' || !isGuardedCommand(command)) return null;
  const hits = findAttribution([command, ...fileTexts(command, input.cwd)].join('\n'));
  if (!hits.length) return null;
  const found = hits.map((h) => `"${h}"`).join(', ');
  const advice = `Found AI attribution (${found}). Remove it: no Co-Authored-By Claude trailer, no "Generated with Claude" line, no robot emoji, no claude.ai/code link. Then retry.`;
  if (mode === 'warn') {
    return {
      systemMessage: `Commit guard: AI attribution found (${found}).`,
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: advice },
    };
  }
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `${advice} Change this guard with /config (pantoo plugin, Commit guard).`,
    },
  };
}

function main() {
  try {
    const raw = process.env.CLAUDE_PLUGIN_OPTION_COMMIT_GUARD;
    const mode = ['block', 'warn', 'off'].includes(raw) ? raw : 'block';
    const result = decide(JSON.parse(fs.readFileSync(0, 'utf8')), mode);
    if (result) process.stdout.write(JSON.stringify(result));
  } catch { /* malformed input: never break Bash */ }
  process.exit(0);
}

// Node realpaths the module URL, so compare real paths: the plugin dir may be reached through a symlink.
const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) main();
