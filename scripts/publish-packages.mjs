import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { publishMissingPackages, runFile } from './release-automation.mjs';

const root = resolve(import.meta.dirname, '..');
const directories = ['core', 'cli', 'github-action'];

async function readPackage(directory) {
  const path = resolve(root, 'packages', directory, 'package.json');
  const packageJson = JSON.parse(await readFile(path, 'utf8'));
  return {
    directory: `packages/${directory}`,
    name: packageJson.name,
    version: packageJson.version,
  };
}

const packages = await Promise.all(directories.map(readPackage));
const packDirectory = await mkdtemp(resolve(tmpdir(), 'agentowners-release-'));
let outcomes;

try {
  outcomes = await publishMissingPackages(packages, { packDirectory, root, run: runFile });
} finally {
  await rm(packDirectory, { force: true, recursive: true });
}

for (const outcome of outcomes ?? []) {
  process.stdout.write(`${outcome.name}@${outcome.version}: ${outcome.status}\n`);
}
