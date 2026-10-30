import fs from 'node:fs';
import path from 'node:path';
import { readIfExists, readJson, writeFile, writeJson } from './files.js';
import { kitRoot } from './paths.js';
import { PROJECT_FILE, excludeLocal, isTracked, templatesDir } from './scaffold.js';

// Design tools and how each hands a design over (PLAN.md 13). Facts carry a `checked` date.
export const SOURCES = readJson(path.join(kitRoot, 'plugin', 'design-sources.json'), { ways: [], tools: {} });
export const MCP_FILE = '.mcp.json';
export const README = 'context/designs/README.md';

const sectionStart = (text) => text.search(/^## Sources[ \t]*$/m);
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim().replace(/^`|`$/g, ''));

// Rows of the Sources table in context/designs/README.md, or null when the file or section is missing.
export function readSources(dir) {
  const text = readIfExists(path.join(dir, README));
  if (text === null || sectionStart(text) === -1) return null;
  const lines = text.slice(sectionStart(text)).split('\n').slice(1);
  const end = lines.findIndex((l) => l.startsWith('## '));
  const table = lines.slice(0, end === -1 ? undefined : end).filter((l) => l.trim().startsWith('|'));
  return table.slice(2).map((l) => {
    const [tool = '', way = '', location = '', version = '', synced = '', owner = ''] = cells(l.trim());
    return { tool: tool.toLowerCase(), way: way.toLowerCase(), location, version, synced, owner };
  });
}

// Adds a stub row for `tool`; design-flow fills the location and syncs it. Appends the Sources
// section from the template first when an older README has none.
function addRow(dir, tool, way) {
  const file = path.join(dir, README);
  let text = readIfExists(file);
  const what = `${README} Sources`;
  if (text === null) return { what, status: 'skipped', note: 'no context/designs/; not a UI project?' };
  if (readSources(dir)?.some((r) => r.tool === tool)) return { what, status: 'unchanged', note: `${tool} already listed` };
  if (sectionStart(text) === -1) {
    const template = fs.readFileSync(path.join(templatesDir, README), 'utf8');
    text = `${text.trimEnd()}\n\n${template.slice(sectionStart(template))}`;
  }
  const lines = text.split('\n');
  const from = lines.findIndex((l) => /^## Sources[ \t]*$/.test(l));
  let last = from;
  for (let i = from + 1; i < lines.length && !lines[i].startsWith('## '); i++) if (lines[i].trim().startsWith('|')) last = i;
  lines.splice(last + 1, 0, `| ${tool} | ${way} | {{TBD: location}} | | never | {{TBD: owner}} |`);
  writeFile(file, lines.join('\n'));
  return { what, status: 'added', note: `${tool} (${way}); /pantoo:design-flow fills it in` };
}

// Writes the tool's official MCP server into .mcp.json (if it has one) and records the source.
export function addSource({ name, dir }) {
  const project = readJson(path.join(dir, PROJECT_FILE), null);
  if (!project) throw new Error(`No ${PROJECT_FILE} in ${dir}; run \`npx pantoo-ai new\` first.`);
  const tool = SOURCES.tools[name];
  if (!tool) {
    throw new Error(`Unknown design source "${name ?? ''}". Known: ${Object.keys(SOURCES.tools).join(', ')}. Anything else: /pantoo:design-flow records it.`);
  }
  const results = [];
  if (tool.mcp) {
    const file = path.join(dir, MCP_FILE);
    const config = readJson(file, {});
    config.mcpServers ??= {};
    const current = config.mcpServers[tool.mcp.name];
    if (current) {
      const same = JSON.stringify(current) === JSON.stringify(tool.mcp.server);
      results.push({ what: `${MCP_FILE} ${tool.mcp.name}`, status: 'unchanged', note: same ? '' : 'yours kept; differs from the kit' });
    } else {
      config.mcpServers[tool.mcp.name] = tool.mcp.server;
      writeJson(file, config);
      results.push({ what: `${MCP_FILE} ${tool.mcp.name}`, status: 'added', note: `restart Claude Code, then ${tool.mcp.signIn}` });
    }
    if (project.local && !isTracked(dir, MCP_FILE) && excludeLocal(dir, [`/${MCP_FILE}`])) results.push({ what: '.git/info/exclude', status: 'updated' });
  } else {
    results.push({ what: `source ${name}`, status: 'no MCP server', note: tool.notes });
  }
  results.push(addRow(dir, name, tool.mcp ? 'mcp' : tool.ways[0]));
  return results;
}

// Where each MCP server name is configured: this project's .mcp.json, or only in the person's
// ~/.claude.json (user or local scope), which teammates don't get.
function serverHomes(dir, prof) {
  const homes = {};
  let personal = {};
  try {
    personal = readJson(path.join(prof.home, '.claude.json'), {});
  } catch {
    // An unreadable ~/.claude.json only hides personal servers.
  }
  for (const name of Object.keys(personal.mcpServers ?? {})) homes[name] = '~/.claude.json (user)';
  for (const name of Object.keys(personal.projects?.[dir]?.mcpServers ?? {})) homes[name] = '~/.claude.json (local)';
  for (const name of Object.keys(readJson(path.join(dir, MCP_FILE), {}).mcpServers ?? {})) homes[name] = MCP_FILE;
  return homes;
}

const SECRETISH = /key|token|secret|password|auth/i;

// Header values, secret-looking env values and URL query values must come from ${VAR}.
function literalSecrets(server) {
  const found = Object.entries(server.headers ?? {}).filter(([, v]) => !String(v).includes('${')).map(([k]) => `header ${k}`);
  found.push(...Object.entries(server.env ?? {}).filter(([k, v]) => SECRETISH.test(k) && !String(v).includes('${')).map(([k]) => `env ${k}`));
  try {
    for (const [k, v] of new URL(server.url).searchParams) if (SECRETISH.test(k) && !v.includes('${')) found.push(`url ?${k}`);
  } catch {
    // No url, or one that only parses once ${VAR} is expanded.
  }
  return found;
}

export function sourceChecks(dir, prof, project) {
  const checks = [];
  const add = (level, what, note = '') => checks.push({ level, what, note });
  if (!project.local) {
    for (const [name, server] of Object.entries(readJson(path.join(dir, MCP_FILE), {}).mcpServers ?? {})) {
      const literal = literalSecrets(server);
      if (literal.length) add('fail', `${MCP_FILE} ${name}`, `literal value in ${literal.join(', ')}; use \${VAR} so no secret is committed`);
    }
  }
  if (!project.ui) return checks;
  const rows = readSources(dir);
  if (rows === null) {
    if (fs.existsSync(path.join(dir, README))) add('warn', 'design sources', `no Sources table in ${README}; /pantoo:design-flow adds it`);
    return checks;
  }
  const homes = serverHomes(dir, prof);
  for (const row of rows) {
    const what = `design source ${row.tool}`;
    if (!SOURCES.ways.includes(row.way)) {
      add('warn', what, `unknown way "${row.way}"; use one of ${SOURCES.ways.join(', ')}`);
      continue;
    }
    if (row.way !== 'mcp') {
      add('ok', what, row.way);
      continue;
    }
    const known = SOURCES.tools[row.tool];
    const name = known?.mcp?.name ?? row.tool;
    const home = homes[name];
    if (!home) add('fail', what, known?.mcp ? `no "${name}" server; run \`npx pantoo-ai add source ${row.tool}\`` : `no "${name}" server in ${MCP_FILE}; add the tool's official one`);
    else if (home !== MCP_FILE) add('warn', what, `server only in ${home}; teammates won't have it`);
    else {
      const ours = readJson(path.join(dir, MCP_FILE), {}).mcpServers[name];
      const drift = known?.mcp && ours.url !== known.mcp.server.url;
      add(drift ? 'warn' : 'ok', what, drift ? `url differs from the kit's (${known.mcp.server.url})` : `mcp: ${name}`);
    }
  }
  return checks;
}
