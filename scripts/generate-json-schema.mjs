import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const outputPath = resolve(root, 'packages/core/agentowners.schema.json');
const coreModule = await import(pathToFileURL(resolve(root, 'packages/core/dist/index.mjs')).href);
const generated = `${JSON.stringify(coreModule.generateAgentOwnersJsonSchema(), null, 2)}\n`;

if (process.argv.includes('--check')) {
  let checkedIn = '';
  try {
    checkedIn = await readFile(outputPath, 'utf8');
  } catch {
    throw new Error('Generated JSON Schema is missing. Run pnpm generate:schema.');
  }

  if (checkedIn !== generated) {
    throw new Error('Generated JSON Schema is stale. Run pnpm generate:schema.');
  }

  process.stdout.write('Generated JSON Schema is current.\n');
} else {
  await writeFile(outputPath, generated);
  process.stdout.write(`Wrote ${outputPath}\n`);
}
