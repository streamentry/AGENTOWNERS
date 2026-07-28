import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const cli = resolve(root, 'packages/cli/dist/index.js');
const policy = resolve(root, 'examples/strict-oss/AGENTOWNERS.yml');
const fixtures = resolve(root, 'examples/strict-oss/AGENTOWNERS.fixtures.yml');

process.stdout.write('AGENTOWNERS executable product proof\n');
process.stdout.write('Policy: examples/strict-oss/AGENTOWNERS.yml\n');
process.stdout.write('Cases: approval, block, and dependency review\n\n');

const result = spawnSync(
  process.execPath,
  [cli, 'test', '--policy', policy, '--fixtures', fixtures],
  { cwd: root, stdio: 'inherit' },
);

if (result.error) {
  process.stderr.write(`Unable to run the built CLI: ${result.error.message}\n`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
