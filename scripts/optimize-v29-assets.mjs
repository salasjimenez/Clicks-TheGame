import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const roots = ['assets/icons/achievements', 'assets/backgrounds'];
let files = 0;
let changed = 0;
let beforeBytes = 0;
let afterBytes = 0;

async function visit(directory) {
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(path);
      continue;
    }
    if (extname(entry.name).toLowerCase() !== '.svg') continue;
    const source = await readFile(path, 'utf8');
    const optimized = source
      .replace(/<!--[^]*?-->/g, '')
      .replace(/>\s+</g, '><')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\r?\n/g, '')
      .trim();
    const output = `${optimized}\n`;
    const before = Buffer.byteLength(source);
    const after = Buffer.byteLength(output);
    files += 1;
    beforeBytes += before;
    afterBytes += Math.min(before, after);
    if (after < before) {
      await writeFile(path, output, 'utf8');
      changed += 1;
    }
  }
}

for (const root of roots) await visit(root);
const saved = Math.max(0, beforeBytes - afterBytes);
console.log(`Assets SVG revisados: ${files}`);
console.log(`Assets optimizados: ${changed}`);
console.log(`Ahorro lossless estimado: ${saved} bytes`);
