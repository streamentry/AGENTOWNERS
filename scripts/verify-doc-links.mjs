import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const markdownFiles = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) await collect(join(directory, entry.name));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) markdownFiles.push(join(directory, entry.name));
  }
}

function localTarget(href, file) {
  if (!href || href.startsWith('#') || /^(?:https?:|mailto:|tel:)/i.test(href)) return undefined;
  const withoutFragment = href.split('#', 1)[0];
  return withoutFragment ? resolve(dirname(file), withoutFragment) : undefined;
}

await collect(root);

const missing = [];
const linkPattern = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
for (const file of markdownFiles) {
  const contents = await readFile(file, 'utf8');
  for (const match of contents.matchAll(linkPattern)) {
    const target = localTarget(match[1], file);
    if (target && !existsSync(target)) {
      missing.push(`${file.slice(root.length + 1)} -> ${match[1]}`);
    }
  }
}

if (missing.length > 0) {
  console.error('Broken local Markdown links:');
  for (const link of missing) console.error(`- ${link}`);
  process.exitCode = 1;
} else {
  console.log(`Markdown link targets verified (${markdownFiles.length} files).`);
}
