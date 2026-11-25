// Same as package.json `engines`. npm only warns on `engines`, so the CLI checks it before running.
export const MIN_NODE = '22.20.0';

export function nodeAtLeast(version, min) {
  const a = version.split('.').map((n) => parseInt(n, 10) || 0);
  const b = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}
