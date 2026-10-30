// SessionStart hook: reminds to resume when a saved session exists.
import fs from 'node:fs';
import path from 'node:path';

const pad = (n) => String(n).padStart(2, '0');

try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  const dir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const file = path.join(dir, 'context', 'session.md');
  const d = fs.statSync(file).mtime;
  const when = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `A saved session exists in context/session.md (last saved ${when} local). Before other work, offer to run /pantoo:save-session resume.`,
    },
  }));
} catch { /* no saved session or bad input: stay silent */ }
process.exit(0);
