import { access, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const backupRoot = resolve(root, '.v29-responsive-backup');
const files = ['src/styles.css','assets/css/styles.css','index.html','package.json','package-lock.json','README.md','LICENSE'];

async function exists(path) { try { await access(path); return true; } catch { return false; } }
let restored = 0;
for (const relative of files) {
  const backup = resolve(backupRoot, relative);
  if (!(await exists(backup))) continue;
  await copyFile(backup, resolve(root, relative));
  restored += 1;
}
console.log(`Restaurados ${restored} archivos desde .v29-responsive-backup/.`);
