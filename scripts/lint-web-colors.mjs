import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

// Scan source text so inline styles, CSS, and dynamically composed classes are
// covered by the same rule without adding a CSS parser dependency.
const root = resolve(process.argv[2] ?? 'apps/web');
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.html', '.svg', '.scss']);
const rules = [
  ['raw hex colour', /#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})\b/gi],
  ['Tailwind palette colour', /\b(?:bg|text|border(?:-[xytrblse])?|divide(?:-[xy])?|outline|ring(?:-offset)?|shadow|accent|caret|fill|stroke|decoration|placeholder|from|via|to)-(?:black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950))\b/g],
];
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await check(path); continue; }
    if (!extensions.has(extname(path)) || relative(root, path) === 'src/style.css') continue;
    const source = await readFile(path, 'utf8');
    for (const [message, pattern] of rules) {
      for (const match of source.matchAll(pattern)) {
        const line = source.slice(0, match.index).split('\n').length;
        console.error(`${relative(process.cwd(), path)}:${line}: ${message} ${match[0]}; use a design token.`);
        process.exitCode = 1;
      }
    }
  }
}
await check(root);
