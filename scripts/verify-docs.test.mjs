import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { findMissingTargets } from './verify-docs.mjs';

test('accepts local links, images, anchors, and external URLs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agentowners-docs-'));
  try {
    await mkdir(join(root, 'docs'));
    await writeFile(join(root, 'README.md'), [
      '[guide](docs/guide.md)',
      '![preview](docs/preview.png)',
      '[anchor](#local)',
      '[external](https://example.com/missing)',
    ].join('\n'));
    await writeFile(join(root, 'docs/guide.md'), '# Guide\n');
    await writeFile(join(root, 'docs/preview.png'), 'fixture\n');

    assert.deepEqual(findMissingTargets(root, ['README.md']), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('reports the source document and missing local target', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agentowners-docs-'));
  try {
    await writeFile(join(root, 'README.md'), '[missing](docs/nope.md)\n');

    assert.deepEqual(findMissingTargets(root, ['README.md']), [
      { document: 'README.md', target: 'docs/nope.md', reason: 'local target is missing' },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
