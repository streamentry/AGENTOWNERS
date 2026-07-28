import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packageDirectories = ['core', 'cli', 'github-action'];
const temporaryRoot = await mkdtemp(join(tmpdir(), 'agentowners-pack-'));
const packDirectory = join(temporaryRoot, 'packages');
const consumerDirectory = join(temporaryRoot, 'consumer');

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();
}

async function packageVersion(directory) {
  const contents = await readFile(resolve(root, 'packages', directory, 'package.json'), 'utf8');
  return JSON.parse(contents).version;
}

try {
  await Promise.all([
    mkdir(packDirectory, { recursive: true }),
    mkdir(consumerDirectory, { recursive: true }),
  ]);

  const archives = [];
  for (const directory of packageDirectories) {
    const output = run(
      'pnpm',
      ['pack', '--pack-destination', packDirectory],
      resolve(root, 'packages', directory),
    );
    archives.push(resolve(packDirectory, basename(output)));
  }

  run('npm', ['init', '--yes'], consumerDirectory);
  run('npm', ['install', '--ignore-scripts', ...archives], consumerDirectory);
  run('npm', ['audit', '--audit-level=high', '--omit=dev'], consumerDirectory);

  const cliVersion = await packageVersion('cli');
  const cliPath = resolve(consumerDirectory, 'node_modules', '.bin', 'agentowners');
  const installedVersion = run(cliPath, ['--version'], consumerDirectory);
  if (installedVersion !== cliVersion) {
    throw new Error(
      `Packed CLI version mismatch: expected ${cliVersion}, received ${installedVersion}`,
    );
  }

  run(
    process.execPath,
    [
      '-e',
      "const core=require('@agent-owners/core'); if(typeof core.evaluatePolicy!=='function') process.exit(1)",
    ],
    consumerDirectory,
  );
  run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import { evaluatePolicy } from '@agent-owners/core'; if(typeof evaluatePolicy!=='function') process.exit(1)",
    ],
    consumerDirectory,
  );

  const fixtureDirectory = resolve(consumerDirectory, 'fixture');
  await mkdir(fixtureDirectory);
  run('git', ['init'], fixtureDirectory);
  run(cliPath, ['init', '--profile', 'minimal'], fixtureDirectory);
  run(cliPath, ['validate', '.github/AGENTOWNERS.yml'], fixtureDirectory);

  process.stdout.write('Packed packages install and execute successfully.\n');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
