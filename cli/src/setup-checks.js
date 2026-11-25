import path from 'node:path';

// Checks on how the machine is set up for the work, beyond what the kit installs. Each reads through
// `sys` (see realSystem), changes nothing, and says how to fix what it finds.

const row = (level, what, note = '') => ({ level, what, note });
const paths = (sys) => (sys.platform === 'win32' ? path.win32 : path.posix);
const homeOf = (sys) => sys.env.HOME || sys.env.USERPROFILE || '';

export function ghChecks(sys) {
  if (!sys.which('gh')) return [row('warn', 'gh', 'GitHub CLI not found; install it from https://cli.github.com')];
  return [sys.run('gh', ['auth', 'status']) === null
    ? row('warn', 'gh', 'not logged in; run `gh auth login`')
    : row('ok', 'gh', 'logged in')];
}

const LONG_PATHS_KEY = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem';

function longPathChecks(sys) {
  const fixes = [];
  if (sys.run('git', ['config', '--get', 'core.longpaths'])?.trim() !== 'true') fixes.push('run `git config --global core.longpaths true`');
  if (!/LongPathsEnabled\s+REG_DWORD\s+0x1\b/.test(sys.output('reg', ['query', LONG_PATHS_KEY, '/v', 'LongPathsEnabled']) ?? '')) {
    fixes.push(`in an administrator terminal, run \`reg add ${LONG_PATHS_KEY} /v LongPathsEnabled /t REG_DWORD /d 1 /f\``);
  }
  return [fixes.length ? row('warn', 'Windows long paths', `off; ${fixes.join('; ')}`) : row('ok', 'Windows long paths')];
}

function scriptShellChecks(sys, gitBash) {
  const value = sys.run('npm', ['config', 'get', 'script-shell'])?.trim();
  if (value && /bash(\.exe)?$/i.test(value)) return [row('ok', 'npm script-shell', value)];
  const now = value && value !== 'null' && value !== 'undefined' ? value : 'cmd.exe';
  return [row('warn', 'npm script-shell', `npm scripts run in ${now}; run \`npm config set script-shell "${gitBash ?? '<path to Git Bash bash.exe>'}"\``)];
}

// `dir` is where doctor runs. Its own git config can override the user's.
function autocrlfChecks(sys, dir) {
  const value = sys.run('git', [...(dir ? ['-C', dir] : []), 'config', '--get', 'core.autocrlf'])?.trim() || 'unset';
  const top = dir && sys.run('git', ['-C', dir, 'rev-parse', '--show-toplevel'])?.trim();
  const bare = top && ![dir, top].some((d) => sys.exists(paths(sys).join(d, '.gitattributes')));
  return [value === 'true' && bare
    ? row('warn', 'core.autocrlf', 'true, and this repo has no .gitattributes, so it checks out CRLF; add one with `* text=auto eol=lf`, or run `git config --global core.autocrlf input`')
    : row('ok', 'core.autocrlf', value)];
}

export function windowsChecks(sys, { dir, gitBash } = {}) {
  if (sys.platform !== 'win32') return [];
  return [...longPathChecks(sys), ...scriptShellChecks(sys, gitBash), ...autocrlfChecks(sys, dir)];
}

const RC_FILES = ['.bashrc', '.bash_profile', '.profile', '.zshrc', '.zprofile'];

// `--use-on-cd` hooks `cd`, and Claude Code's shell keeps the hook without fnm's variables.
export const guardedFnm = (shell) => `if [ -n "$CLAUDECODE" ]; then eval "$(fnm env --shell ${shell})"; else eval "$(fnm env --use-on-cd --shell ${shell})"; fi`;

// Only reads the dotfiles. A file that mentions CLAUDECODE outside a comment counts as guarded.
export function shellRcChecks(sys, home) {
  return RC_FILES.flatMap((name) => {
    const lines = (sys.read(paths(sys).join(home, name)) ?? '').split(/\r?\n/).filter((l) => !/^\s*#/.test(l));
    if (!lines.some((l) => /\bfnm env\b.*--use-on-cd/.test(l)) || lines.some((l) => l.includes('CLAUDECODE'))) return [];
    const shell = name.startsWith('.z') ? 'zsh' : 'bash';
    return [row('warn', `~/${name}`, `\`fnm env --use-on-cd\` can break \`cd\` in Claude Code's shell; replace that line with: ${guardedFnm(shell)}`)];
  });
}

const PLACEHOLDER_BINARY = 'claude native binary not installed';

// A failed self-update can leave the npm package's binary as a small script that only prints an
// error. Looks at what `claude` on PATH is, and at the package behind a Windows `.cmd` shim.
export function claudeBinaryChecks(sys) {
  const found = sys.which('claude');
  if (!found) return [];
  const p = paths(sys);
  const pkg = ['@anthropic-ai', 'claude-code', 'bin', 'claude.exe'];
  const beside = p.dirname(found);
  const candidates = [sys.realpath(found), p.join(beside, 'node_modules', ...pkg), p.join(beside, '..', 'lib', 'node_modules', ...pkg)];
  const broken = candidates.find((f) => {
    const size = sys.size(f);
    return size !== null && size < 4096 && (sys.read(f) ?? '').split('\n')[0].includes(PLACEHOLDER_BINARY);
  });
  if (!broken) return [];
  return [row('fail', 'claude binary', `${broken} is a placeholder, not the program; run \`node install.cjs\` in ${p.dirname(p.dirname(broken))}`)];
}

// Where Playwright downloads its browsers, as its docs give it.
function browsersDir(sys, dir) {
  const p = paths(sys);
  const set = sys.env.PLAYWRIGHT_BROWSERS_PATH;
  if (set === '0') return p.join(dir, 'node_modules', 'playwright-core', '.local-browsers');
  if (set) return set;
  if (sys.platform === 'win32') return p.join(sys.env.LOCALAPPDATA || p.join(homeOf(sys), 'AppData', 'Local'), 'ms-playwright');
  if (sys.platform === 'darwin') return p.join(homeOf(sys), 'Library', 'Caches', 'ms-playwright');
  return p.join(sys.env.XDG_CACHE_HOME || p.join(homeOf(sys), '.cache'), 'ms-playwright');
}

export function playwrightChecks(sys, dir) {
  if (!dir) return [];
  let pkg;
  try {
    pkg = JSON.parse(sys.read(paths(sys).join(dir, 'package.json'))?.replace(/^\uFEFF/, '') ?? 'null');
  } catch { return []; }
  if (!['dependencies', 'devDependencies'].some((k) => pkg?.[k]?.['@playwright/test'])) return [];
  const folder = browsersDir(sys, dir);
  const installed = sys.list(folder).some((n) => /^(chromium|firefox|webkit)/.test(n));
  return [installed
    ? row('ok', 'Playwright browsers', folder)
    : row('warn', 'Playwright browsers', `none in ${folder}; run \`npx playwright install\``)];
}

// `home` holds the dotfiles (the `--home` profile in a test run).
export function setupChecks(sys, { dir, home, gitBash }) {
  return [
    ...claudeBinaryChecks(sys),
    ...ghChecks(sys),
    ...windowsChecks(sys, { dir, gitBash }),
    ...shellRcChecks(sys, home),
    ...playwrightChecks(sys, dir),
  ];
}
