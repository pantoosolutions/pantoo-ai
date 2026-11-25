#!/usr/bin/env node
import { MIN_NODE, nodeAtLeast } from '../src/node-version.js';

// Before anything runs: an older Node gets halfway through an install, then the `skills` CLI fails.
if (!nodeAtLeast(process.versions.node, MIN_NODE)) {
  console.error(`pantoo-ai needs Node ${MIN_NODE} or later; this is ${process.versions.node}. https://nodejs.org/en/download`);
  process.exit(1);
}

const { main } = await import('../src/index.js');
main(process.argv.slice(2)).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
