import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const prereleaseVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)$/;
const npmRegistry = 'https://registry.npmjs.org';

function commandFailure(command, args, result) {
  const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
  return new Error(
    `${command} ${args.join(' ')} failed with status ${String(result.status)}${
      detail ? `:\n${detail}` : ''
    }`,
  );
}

export function runFile(command, args, options = {}) {
  return new Promise((resolveResult) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => resolveResult({ error, status: null, stderr, stdout }));
    child.on('close', (status) => resolveResult({ status, stderr, stdout }));
  });
}

export function classifyRegistryLookup(result, expectedVersion) {
  if (result.status === 0) {
    let version;
    try {
      version = JSON.parse(result.stdout);
    } catch {
      throw new Error(`Registry returned invalid JSON for ${expectedVersion}`);
    }
    if (version !== expectedVersion) {
      throw new Error(
        `Registry returned unexpected version ${JSON.stringify(version)} for ${expectedVersion}`,
      );
    }
    return 'existing';
  }
  const output = `${result.stderr}\n${result.stdout}`;
  const errorCodes = [...output.matchAll(/\bnpm\s+(?:error|ERR!)\s+code\s+(E[A-Z0-9_]+)/gi)].map(
    (match) => match[1].toUpperCase(),
  );
  if (errorCodes.length > 0 && errorCodes.every((code) => code === 'E404')) return 'missing';
  throw new Error(
    `Registry lookup failed for ${expectedVersion}: ${
      result.error?.message ?? result.stderr.trim() ?? `status ${String(result.status)}`
    }`,
  );
}

export function requireCompatibleNpm(versionOutput) {
  const match = versionOutput.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`npm returned an invalid npm version: ${versionOutput.trim()}`);
  const current = match.slice(1).map(Number);
  const minimum = [11, 5, 1];
  const compatible = current.some((part, index) => {
    const earlierPartsMatch = current
      .slice(0, index)
      .every((value, position) => value === minimum[position]);
    return earlierPartsMatch && part > minimum[index];
  });
  if (!compatible && current.some((part, index) => part !== minimum[index])) {
    throw new Error(
      `Trusted publishing requires npm 11.5.1 or newer; found ${versionOutput.trim()}`,
    );
  }
}

async function lookupPackage(packageInfo, options) {
  const spec = `${packageInfo.name}@${packageInfo.version}`;
  const lookupArgs = ['view', spec, 'version', '--json', '--registry', npmRegistry];
  const lookup = await options.run('npm', lookupArgs, { cwd: options.root });
  return {
    ...packageInfo,
    registryState: classifyRegistryLookup(lookup, packageInfo.version),
  };
}

async function packAndPublish(packageInfo, options) {
  const cwd = resolve(options.root, packageInfo.directory);
  const packArgs = ['pack', '--pack-destination', options.packDirectory];
  const packed = await options.run('pnpm', packArgs, { cwd });
  if (packed.status !== 0) throw commandFailure('pnpm', packArgs, packed);

  const expectedTarball = resolve(options.packDirectory, tarballName(packageInfo));
  const outputFiles = packed.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((path) => resolve(path));
  if (!outputFiles.includes(expectedTarball)) {
    throw new Error(`pnpm pack did not report expected tarball ${expectedTarball}`);
  }

  const publishArgs = [
    'publish',
    expectedTarball,
    '--provenance',
    '--access',
    'public',
    '--registry',
    npmRegistry,
  ];
  const published = await options.run('npm', publishArgs, { cwd: options.root });
  if (published.status !== 0) throw commandFailure('npm', publishArgs, published);
}

function tarballName(packageInfo) {
  const normalizedName = packageInfo.name.replace(/^@/, '').replaceAll('/', '-');
  return `${normalizedName}-${packageInfo.version}.tgz`;
}

export async function publishMissingPackages(packages, options) {
  const npmVersion = await options.run('npm', ['--version'], { cwd: options.root });
  if (npmVersion.status !== 0) throw commandFailure('npm', ['--version'], npmVersion);
  requireCompatibleNpm(npmVersion.stdout);

  const states = [];
  for (const packageInfo of packages) {
    states.push(await lookupPackage(packageInfo, options));
  }

  const outcomes = [];
  for (const packageInfo of states) {
    if (packageInfo.registryState === 'missing') {
      await packAndPublish(packageInfo, options);
    }
    outcomes.push({
      name: packageInfo.name,
      status: packageInfo.registryState === 'existing' ? 'skipped' : 'published',
      version: packageInfo.version,
    });
  }
  return outcomes;
}

export function deriveReleaseTags(version) {
  const match = version.match(stableVersionPattern) ?? version.match(prereleaseVersionPattern);
  if (!match) throw new Error(`${version} is not a valid semantic version`);
  return {
    majorTag: stableVersionPattern.test(version) ? `v${match[1]}` : null,
    releaseTag: `v${version}`,
  };
}

async function runGit(args, options) {
  const result = await options.run('git', args, { cwd: options.root });
  if (result.status !== 0) throw commandFailure('git', args, result);
}

export async function updateMajorTag(options) {
  const { majorTag } = deriveReleaseTags(options.version);
  if (!majorTag) return null;
  if (!/^[0-9a-f]{40}$/.test(options.sha)) {
    throw new Error('Release commit must be a full 40-character Git SHA');
  }
  await runGit(['tag', '--force', majorTag, options.sha], options);
  await runGit(['push', 'origin', `refs/tags/${majorTag}`, '--force'], options);
  return majorTag;
}
