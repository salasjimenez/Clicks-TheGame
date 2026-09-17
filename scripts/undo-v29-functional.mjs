import { access, copyFile, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

const root = process.cwd();
const backupRoot = resolve(root, '.v29-functional-backup');

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

const manifestPath = resolve(backupRoot, 'manifest.json');
if (!(await exists(manifestPath))) throw new Error('No existe .v29-functional-backup/manifest.json.');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

for (const relativePath of manifest.backedUp ?? []) {
  const source = resolve(backupRoot, relativePath);
  const target = resolve(root, relativePath);
  if (!(await exists(source))) continue;
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

for (const relativePath of manifest.createdFiles ?? []) {
  await rm(resolve(root, relativePath), { force: true });
}
for (const relativePath of [
  'assets/js/features/v29-core.js',
  'assets/js/features/v29-state.js',
  'assets/js/features/v29.js'
]) {
  await rm(resolve(root, relativePath), { force: true });
}

console.log('Fase funcional v2.9 revertida desde .v29-functional-backup/.');
console.log('El overlay responsive v2.9 se conserva.');
