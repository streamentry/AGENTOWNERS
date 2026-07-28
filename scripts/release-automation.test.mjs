import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyRegistryLookup,
  deriveReleaseTags,
  requireCompatibleNpm,
  publishMissingPackages,
  updateMajorTag,
} from './release-automation.mjs';

const packages = [
  { directory: 'packages/core', name: '@agent-owners/core', version: '0.1.0' },
  { directory: 'packages/cli', name: '@agent-owners/cli', version: '0.1.0' },
];

test('classifies an exact published version as existing', () => {
  assert.equal(
    classifyRegistryLookup({ status: 0, stdout: '"0.1.0"\n', stderr: '' }, '0.1.0'),
    'existing',
  );
});

test('classifies only an npm E404 as missing', () => {
  assert.equal(
    classifyRegistryLookup(
      { status: 1, stdout: '', stderr: 'npm error code E404\nnpm error 404 Not Found' },
      '0.1.0',
    ),
    'missing',
  );
});

test('rejects authentication and network failures instead of publishing', () => {
  assert.throws(
    () =>
      classifyRegistryLookup(
        { status: 1, stdout: '', stderr: 'npm error code E401\nUnable to authenticate' },
        '0.1.0',
      ),
    /registry lookup failed.*E401/i,
  );
  assert.throws(
    () =>
      classifyRegistryLookup(
        { status: 1, stdout: '', stderr: 'npm error code EAI_AGAIN' },
        '0.1.0',
      ),
    /registry lookup failed.*EAI_AGAIN/i,
  );
});

test('rejects a successful lookup that returns a different version', () => {
  assert.throws(
    () => classifyRegistryLookup({ status: 0, stdout: '"0.0.9"\n', stderr: '' }, '0.1.0'),
    /unexpected version/i,
  );
});

test('requires an npm CLI version that supports trusted publishing', () => {
  assert.doesNotThrow(() => requireCompatibleNpm('11.5.1\n'));
  assert.doesNotThrow(() => requireCompatibleNpm('12.0.0'));
  assert.throws(() => requireCompatibleNpm('11.5.0'), /npm 11\.5\.1 or newer/i);
  assert.throws(() => requireCompatibleNpm('not-a-version'), /valid npm version/i);
});

test('skips existing versions and publishes missing packages in order', async () => {
  const calls = [];
  const run = async (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
    if (command === 'npm' && args[0] === '--version') {
      return { status: 0, stdout: '11.16.0\n', stderr: '' };
    }
    if (command === 'npm' && args[0] === 'view' && args[1].includes('/core@')) {
      return { status: 0, stdout: '"0.1.0"\n', stderr: '' };
    }
    if (command === 'npm' && args[0] === 'view') {
      return { status: 1, stdout: '', stderr: 'npm error code E404' };
    }
    if (command === 'pnpm') {
      return {
        status: 0,
        stdout: '/tmp/release-packages/agent-owners-cli-0.1.0.tgz\n',
        stderr: '',
      };
    }
    return { status: 0, stdout: '', stderr: '' };
  };

  const outcomes = await publishMissingPackages(packages, {
    packDirectory: '/tmp/release-packages',
    root: '/repo',
    run,
  });

  assert.deepEqual(outcomes, [
    { name: '@agent-owners/core', status: 'skipped', version: '0.1.0' },
    { name: '@agent-owners/cli', status: 'published', version: '0.1.0' },
  ]);
  assert.deepEqual(calls, [
    {
      command: 'npm',
      args: ['--version'],
      cwd: '/repo',
    },
    {
      command: 'npm',
      args: ['view', '@agent-owners/core@0.1.0', 'version', '--json'],
      cwd: '/repo',
    },
    {
      command: 'npm',
      args: ['view', '@agent-owners/cli@0.1.0', 'version', '--json'],
      cwd: '/repo',
    },
    {
      command: 'pnpm',
      args: ['pack', '--pack-destination', '/tmp/release-packages'],
      cwd: '/repo/packages/cli',
    },
    {
      command: 'npm',
      args: [
        'publish',
        '/tmp/release-packages/agent-owners-cli-0.1.0.tgz',
        '--provenance',
        '--access',
        'public',
      ],
      cwd: '/repo',
    },
  ]);
});

test('stops immediately when a registry lookup is ambiguous', async () => {
  const calls = [];
  const run = async (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
    if (args[0] === '--version') {
      return { status: 0, stdout: '11.16.0\n', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'npm error code E500' };
  };

  await assert.rejects(
    publishMissingPackages(packages, {
      packDirectory: '/tmp/release-packages',
      root: '/repo',
      run,
    }),
    /registry lookup failed.*E500/i,
  );
  assert.equal(calls.length, 2);
});

test('checks every package before publishing any of them', async () => {
  const calls = [];
  const run = async (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
    if (args[0] === '--version') {
      return { status: 0, stdout: '11.16.0\n', stderr: '' };
    }
    if (args[0] === 'view' && args[1].includes('/core@')) {
      return { status: 1, stdout: '', stderr: 'npm error code E404' };
    }
    return { status: 1, stdout: '', stderr: 'npm error code E500' };
  };

  await assert.rejects(
    publishMissingPackages(packages, {
      packDirectory: '/tmp/release-packages',
      root: '/repo',
      run,
    }),
    /registry lookup failed.*E500/i,
  );
  assert.deepEqual(
    calls.map(({ command, args }) => [command, args[0]]),
    [
      ['npm', '--version'],
      ['npm', 'view'],
      ['npm', 'view'],
    ],
  );
});

test('derives an exact release tag and moves a major tag only for stable versions', () => {
  assert.deepEqual(deriveReleaseTags('2.4.1'), {
    majorTag: 'v2',
    releaseTag: 'v2.4.1',
  });
  assert.deepEqual(deriveReleaseTags('2.4.1-rc.1'), {
    majorTag: null,
    releaseTag: 'v2.4.1-rc.1',
  });
  assert.throws(() => deriveReleaseTags('2.4'), /valid semantic version/i);
});

test('updates only the derived major tag to the release commit', async () => {
  const calls = [];
  const run = async (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
    return { status: 0, stdout: '', stderr: '' };
  };

  const result = await updateMajorTag({
    root: '/repo',
    run,
    sha: '0123456789abcdef0123456789abcdef01234567',
    version: '2.4.1',
  });

  assert.equal(result, 'v2');
  assert.deepEqual(calls, [
    {
      command: 'git',
      args: ['tag', '--force', 'v2', '0123456789abcdef0123456789abcdef01234567'],
      cwd: '/repo',
    },
    {
      command: 'git',
      args: ['push', 'origin', 'refs/tags/v2', '--force'],
      cwd: '/repo',
    },
  ]);
});

test('does not move a major tag for a prerelease', async () => {
  let called = false;
  const result = await updateMajorTag({
    root: '/repo',
    run: async () => {
      called = true;
      return { status: 0, stdout: '', stderr: '' };
    },
    sha: '0123456789abcdef0123456789abcdef01234567',
    version: '2.4.1-beta.1',
  });

  assert.equal(result, null);
  assert.equal(called, false);
});
