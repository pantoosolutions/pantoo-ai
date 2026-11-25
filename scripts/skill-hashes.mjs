// Prints the folder hashes third-party.json pins. When a pin moves: install the new one into an empty
// folder, run this on its .claude/skills, and move the old tag, sha and hashes into `previous`, so
// doctor can call an old copy "older".
import fs from 'node:fs';
import path from 'node:path';
import { folderHash } from '../cli/src/third-party.js';

const root = process.argv[2];
if (!root) {
  console.error('usage: node scripts/skill-hashes.mjs <a .claude/skills folder>');
  process.exit(1);
}
const names = fs.readdirSync(root).filter((n) => fs.existsSync(path.join(root, n, 'SKILL.md'))).sort();
console.log(JSON.stringify(Object.fromEntries(names.map((n) => [n, folderHash(path.join(root, n))])), null, 2));
