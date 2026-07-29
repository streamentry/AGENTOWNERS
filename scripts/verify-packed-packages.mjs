import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packageDirectories = ['core', 'cli', 'github-action'];
const temporaryRoot = await mkdtemp(join(tmpdir(), 'agentowners-pack-'));
const packDirectory = join(temporaryRoot, 'packages');
const consumerDirectory = join(temporaryRoot, 'consumer');
const npmCacheDirectory = join(temporaryRoot, 'npm-cache');

function commandEnvironment(command) {
  if (command !== 'npm') return process.env;
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.toLowerCase().startsWith('npm_config_')),
  );
  return { ...environment, npm_config_cache: npmCacheDirectory };
}

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: commandEnvironment(command),
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
      "const core=require('@agent-owners/core'); if(typeof core.evaluatePolicy!=='function'||typeof core.parsePolicyFixtureSuite!=='function'||typeof core.runPolicyFixtureSuite!=='function'||typeof core.renderSarif!=='function'||typeof core.diffPolicies!=='function'||typeof core.hashPolicy!=='function') process.exit(1)",
    ],
    consumerDirectory,
  );
  run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import { diffPolicies,evaluatePolicy,hashPolicy,parsePolicyFixtureSuite,renderSarif,runPolicyFixtureSuite } from '@agent-owners/core'; if(typeof evaluatePolicy!=='function'||typeof parsePolicyFixtureSuite!=='function'||typeof runPolicyFixtureSuite!=='function'||typeof renderSarif!=='function'||typeof diffPolicies!=='function'||typeof hashPolicy!=='function') process.exit(1)",
    ],
    consumerDirectory,
  );
  run(
    process.execPath,
    [
      '-e',
      "const schema=require('@agent-owners/core/schema.json'); if(schema.title!=='AGENTOWNERS policy') process.exit(1)",
    ],
    consumerDirectory,
  );

  const fixtureDirectory = resolve(consumerDirectory, 'fixture');
  await mkdir(fixtureDirectory);
  run('git', ['init'], fixtureDirectory);
  run('git', ['config', 'user.name', 'Package verifier'], fixtureDirectory);
  run('git', ['config', 'user.email', 'verifier@example.invalid'], fixtureDirectory);
  run(cliPath, ['init', '--profile', 'minimal'], fixtureDirectory);
  run(cliPath, ['validate', '.github/AGENTOWNERS.yml'], fixtureDirectory);
  const policyPath = resolve(fixtureDirectory, '.github/AGENTOWNERS.yml');
  const proposedPolicyPath = resolve(fixtureDirectory, 'AGENTOWNERS.proposed.yml');
  const policyText = await readFile(policyPath, 'utf8');
  if (!policyText.includes('docs_only: allow')) {
    throw new Error('Packed policy fixture did not contain the expected baseline default');
  }
  await writeFile(proposedPolicyPath, policyText.replace('docs_only: allow', 'docs_only: block'));
  const policyDiff = JSON.parse(
    run(
      cliPath,
      [
        'policy-diff',
        '--base',
        policyPath,
        '--proposed',
        proposedPolicyPath,
        '--format',
        'json',
      ],
      fixtureDirectory,
    ),
  );
  if (
    policyDiff.schemaVersion !== 1 ||
    policyDiff.status !== 'complete' ||
    policyDiff.diff?.identical !== false ||
    !policyDiff.diff?.changes?.some(
      (change) => change.path === '/defaults/docs_only' && change.kind === 'changed',
    )
  ) {
    throw new Error('Packed CLI policy diff returned an unexpected contract');
  }
  run('git', ['add', '.github/AGENTOWNERS.yml'], fixtureDirectory);
  run('git', ['commit', '-m', 'chore: initialize policy'], fixtureDirectory);
  await writeFile(resolve(fixtureDirectory, 'README.md'), '# Fixture\n');
  run('git', ['add', 'README.md'], fixtureDirectory);
  run('git', ['commit', '-m', 'docs: add readme'], fixtureDirectory);

  const selfCheck = JSON.parse(
    run(
      cliPath,
      [
        'self-check',
        '--policy',
        '.github/AGENTOWNERS.yml',
        '--base',
        'HEAD~1',
        '--head',
        'HEAD',
        '--actor',
        'package-verifier',
      ],
      fixtureDirectory,
    ),
  );
  if (
    selfCheck.schemaVersion !== 1 ||
    selfCheck.status !== 'complete' ||
    selfCheck.decision !== 'allow'
  ) {
    throw new Error('Packed CLI self-check returned an unexpected contract');
  }

  const sarifResult = JSON.parse(
    run(
      cliPath,
      [
        'check',
        '--policy',
        '.github/AGENTOWNERS.yml',
        '--base',
        'HEAD~1',
        '--head',
        'HEAD',
        '--actor',
        'package-verifier',
        '--output',
        'sarif',
      ],
      fixtureDirectory,
    ),
  );
  if (
    sarifResult.$schema !== 'https://json.schemastore.org/sarif-2.1.0.json' ||
    sarifResult.version !== '2.1.0' ||
    sarifResult.runs?.[0]?.properties?.decision !== 'allow' ||
    sarifResult.runs?.[0]?.results?.length !== 0
  ) {
    throw new Error('Packed CLI SARIF output returned an unexpected contract');
  }

  await writeFile(
    resolve(fixtureDirectory, 'AGENTOWNERS.fixtures.yml'),
    [
      'version: 1',
      'cases:',
      '  - name: documentation is allowed',
      '    input:',
      '      event: pull_request.opened',
      '      actor: package-verifier',
      '      changed_files: [README.md]',
      '    expect:',
      '      decision: allow',
    ].join('\n'),
  );
  const fixtureResult = JSON.parse(
    run(
      cliPath,
      [
        'test',
        '--policy',
        '.github/AGENTOWNERS.yml',
        '--fixtures',
        'AGENTOWNERS.fixtures.yml',
        '--output',
        'json',
      ],
      fixtureDirectory,
    ),
  );
  if (
    fixtureResult.schemaVersion !== 1 ||
    fixtureResult.status !== 'complete' ||
    fixtureResult.result?.passed !== true
  ) {
    throw new Error('Packed CLI fixture test returned an unexpected contract');
  }

  process.stdout.write('Packed packages install and execute successfully.\n');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
