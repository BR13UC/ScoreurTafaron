import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = path.join(root, 'dist', '.tafaron-build-state.json');
const inputs = ['client/index.html', 'client/src', 'server', 'shared', 'scripts/build-state.mjs', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.server.json', 'vite.config.ts'];

function filesFor(input) {
  const absolute = path.join(root, input); if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [absolute];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => filesFor(path.join(input, entry.name)));
}

function fingerprint() {
  const hash = createHash('sha256');
  for (const file of inputs.flatMap(filesFor).sort()) { hash.update(path.relative(root, file).replaceAll('\\', '/')); hash.update('\0'); hash.update(readFileSync(file)); hash.update('\0'); }
  return hash.digest('hex');
}

const command = process.argv[2];
try {
  if (command === 'check') {
    const saved = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')).fingerprint : undefined;
    process.exit(saved === fingerprint() && existsSync(path.join(root, 'dist', 'client', 'index.html')) ? 0 : 2);
  }
  if (command === 'mark') {
    mkdirSync(path.dirname(stateFile), { recursive: true }); writeFileSync(stateFile, `${JSON.stringify({ fingerprint: fingerprint() }, null, 2)}\n`); process.exit(0);
  }
  throw new Error('Commande attendue : check ou mark.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error); process.exit(1);
}
