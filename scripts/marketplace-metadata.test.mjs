import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { afterEach } from 'node:test';

import { verifyMarketplaceMetadata } from './marketplace-metadata.mjs';

const temporaryDirectories = [];

function metadata({ author = 'streamentry', main, runtime = 'node24', extraInput = '' } = {}) {
  return `name: AGENTOWNERS Check
description: Enforces deterministic policy for AI agent contributions.
author: ${author}
branding:
  icon: shield
  color: orange
inputs:
  policy-path:
    description: Policy path
    required: false
    default: .github/AGENTOWNERS.yml
${extraInput}outputs:
  decision:
    description: Final policy decision
runs:
  using: ${runtime}
  main: ${main}
`;
}

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), 'agentowners-marketplace-'));
  temporaryDirectories.push(root);
  await mkdir(join(root, 'packages', 'github-action', 'dist'), { recursive: true });
  await writeFile(
    join(root, 'action.yml'),
    metadata({ main: 'packages/github-action/dist/index.js' }),
  );
  await writeFile(
    join(root, 'packages', 'github-action', 'action.yml'),
    metadata({ author: 'agentowners', main: 'dist/index.js' }),
  );
  await writeFile(join(root, 'packages', 'github-action', 'dist', 'index.js'), '');
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

test('accepts equivalent root and package Marketplace metadata', async () => {
  const root = await makeFixture();

  await assert.doesNotReject(() => verifyMarketplaceMetadata(root));
});

test('rejects metadata drift outside distribution-specific author and bundle path', async () => {
  const root = await makeFixture();
  await writeFile(
    join(root, 'packages', 'github-action', 'action.yml'),
    metadata({
      main: 'dist/index.js',
      extraInput: '  unexpected:\n    description: Drifted input\n',
    }),
  );

  await assert.rejects(() => verifyMarketplaceMetadata(root), /metadata drift/i);
});

test('rejects multiple root Marketplace metadata files', async () => {
  const root = await makeFixture();
  await writeFile(join(root, 'action.yaml'), metadata({ main: 'dist/index.js' }));

  await assert.rejects(() => verifyMarketplaceMetadata(root), /exactly one root action/i);
});

test('rejects missing Marketplace identity fields', async () => {
  const root = await makeFixture();
  await writeFile(
    join(root, 'action.yml'),
    metadata({ author: '', main: 'packages/github-action/dist/index.js' }),
  );

  await assert.rejects(() => verifyMarketplaceMetadata(root), /author/i);
});

test('rejects unsupported runtimes and incorrect bundle paths', async () => {
  const runtimeRoot = await makeFixture();
  await writeFile(
    join(runtimeRoot, 'action.yml'),
    metadata({
      main: 'packages/github-action/dist/index.js',
      runtime: 'node20',
    }),
  );
  await assert.rejects(() => verifyMarketplaceMetadata(runtimeRoot), /Node 24 runtime/i);

  const pathRoot = await makeFixture();
  await writeFile(
    join(pathRoot, 'packages', 'github-action', 'action.yml'),
    metadata({ main: 'lib/index.js' }),
  );
  await assert.rejects(() => verifyMarketplaceMetadata(pathRoot), /runs\.main/i);
});

test('rejects malformed Action YAML', async () => {
  const root = await makeFixture();
  await writeFile(join(root, 'action.yml'), 'name: [unterminated\n');

  await assert.rejects(() => verifyMarketplaceMetadata(root), /invalid action metadata/i);
});
