import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const packageDirectories = ['core', 'cli', 'github-action'];

async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(root, relativePath), 'utf8'));
}

async function assertFile(relativePath) {
  await access(resolve(root, relativePath), constants.R_OK);
}

async function verifyCorePackage() {
  const packageJson = await readJson('packages/core/package.json');
  const exports = packageJson.exports['.'];
  const schemaExport = packageJson.exports['./schema.json'];

  await Promise.all([
    assertFile(`packages/core/${exports.types}`),
    assertFile(`packages/core/${exports.import}`),
    assertFile(`packages/core/${exports.require}`),
    assertFile(`packages/core/${schemaExport}`),
  ]);

  const imported = await import(pathToFileURL(resolve(root, 'packages/core', exports.import)).href);
  const required = require(resolve(root, 'packages/core', exports.require));

  if (typeof imported.evaluatePolicy !== 'function') {
    throw new Error('ESM package export does not expose evaluatePolicy');
  }
  if (typeof required.evaluatePolicy !== 'function') {
    throw new Error('CommonJS package export does not expose evaluatePolicy');
  }
}

async function verifyAction() {
  const action = await readFile(resolve(root, 'action.yml'), 'utf8');
  const mainMatch = action.match(/^\s*main:\s*(.+)\s*$/m);

  if (!mainMatch) throw new Error('action.yml does not declare runs.main');
  if (!/^\s*using:\s*node24\s*$/m.test(action)) {
    throw new Error('action.yml must use the supported Node 24 runtime');
  }

  await assertFile(mainMatch[1].trim());
}

async function verifyCli() {
  const cliPath = resolve(root, 'packages/cli/dist/index.js');
  const cliPackage = await readJson('packages/cli/package.json');
  await assertFile('packages/cli/dist/index.js');
  const version = execFileSync(process.execPath, [cliPath, '--version'], {
    encoding: 'utf8',
  }).trim();

  if (version !== cliPackage.version) {
    throw new Error(`CLI smoke test returned unexpected version: ${version}`);
  }
}

async function verifyPackageMetadata() {
  const rootPackage = await readJson('package.json');
  const packages = await Promise.all(
    packageDirectories.map((directory) => readJson(`packages/${directory}/package.json`)),
  );

  for (const [index, packageJson] of packages.entries()) {
    const directory = packageDirectories[index];
    if (packageJson.version !== rootPackage.version) {
      throw new Error(
        `Version mismatch: packages/${directory} is ${packageJson.version}, root is ${rootPackage.version}`,
      );
    }
    if (packageJson.engines?.node !== rootPackage.engines?.node) {
      throw new Error(
        `Node engine mismatch: packages/${directory} declares ${packageJson.engines?.node}, root declares ${rootPackage.engines?.node}`,
      );
    }
    await assertFile(`packages/${directory}/README.md`);
  }

  if (
    process.env.GITHUB_REF_TYPE === 'tag' &&
    process.env.GITHUB_REF_NAME !== `v${rootPackage.version}`
  ) {
    throw new Error(
      `Tag ${process.env.GITHUB_REF_NAME} does not match package version ${rootPackage.version}`,
    );
  }
}

function verifyCommittedActionBundle() {
  if (!process.env.CI) return;

  try {
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', 'packages/github-action/dist/index.js'], {
      cwd: root,
      stdio: 'ignore',
    });
  } catch {
    throw new Error(
      'Committed GitHub Action bundle is stale. Run pnpm build and commit the result.',
    );
  }
}

function verifyPackedRuntimeGuard() {
  const unexpectedMajor = Number(process.versions.node.split('.')[0]) + 1;
  const result = spawnSync(
    process.execPath,
    [
      resolve(root, 'scripts/verify-packed-packages.mjs'),
      '--node-major',
      String(unexpectedMajor),
    ],
    { cwd: root, encoding: 'utf8' },
  );
  const expectedDiagnostic = `requires Node ${unexpectedMajor}, received ${process.versions.node}`;

  if (result.status === 0 || !result.stderr.includes(expectedDiagnostic)) {
    throw new Error('Packed-package runtime guard did not reject a mismatched Node major');
  }
}

await Promise.all([verifyCorePackage(), verifyAction(), verifyCli(), verifyPackageMetadata()]);
verifyPackedRuntimeGuard();
verifyCommittedActionBundle();
process.stdout.write('Release artifacts verified.\n');
