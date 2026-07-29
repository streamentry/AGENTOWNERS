import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { registerCapabilities, runCapabilities } from '../src/commands/capabilities.js';

const fixtureRoot = resolve(process.cwd(), '../../fixtures/capabilities');
const temporaryDirectories: string[] = [];

describe('capabilities command', () => {
  let stdout = '';
  let stderr = '';

  beforeEach(() => {
    process.exitCode = undefined;
    stdout = '';
    stderr = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += String(chunk);
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += String(chunk);
      return true;
    });
  });

  afterEach(async () => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  function argumentsFor(output = 'text'): { manifest: string; attempts: string; output: string } {
    return {
      manifest: join(fixtureRoot, 'AGENT_CAPABILITIES.json'),
      attempts: join(fixtureRoot, 'attempts.json'),
      output,
    };
  }

  it('registers explicit manifest, attempts, output, and failure options', () => {
    const program = new Command();
    registerCapabilities(program);
    const command = program.commands.find((candidate) => candidate.name() === 'capabilities');

    expect(command?.description()).toContain('capability manifest');
    expect(command?.options.map((option) => option.flags)).toEqual(
      expect.arrayContaining([
        '--manifest <path>',
        '--attempts <path>',
        '--output <format>',
        '--fail-on-deny',
      ]),
    );
  });

  it('prints a deterministic summary and allows expected denials by default', async () => {
    await runCapabilities(argumentsFor());

    expect(stdout).toBe(
      'Capability evaluation complete.\n4 attempts: 1 allowed, 3 denied.\nKill triggered: true.\n',
    );
    expect(stderr).toBe('');
    expect(process.exitCode).toBe(0);
  });

  it('emits the audit contract and fails when requested on denial', async () => {
    await runCapabilities({ ...argumentsFor('json'), failOnDeny: true });

    const result = JSON.parse(stdout) as { summary: { denied: number }; auditDigest: string };
    expect(result.summary.denied).toBe(3);
    expect(result.auditDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(process.exitCode).toBe(1);
  });

  it('reports invalid manifest input without leaking file contents', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentowners-capabilities-cli-'));
    temporaryDirectories.push(directory);
    const manifest = join(directory, 'manifest.json');
    await writeFile(manifest, JSON.stringify({ version: 1, secretValue: 'do-not-print' }));

    await runCapabilities({ ...argumentsFor('json'), manifest });

    expect(process.exitCode).toBe(65);
    expect(JSON.parse(stderr)).toMatchObject({
      status: 'error',
      error: { code: 'INVALID_MANIFEST' },
    });
    expect(stderr).not.toContain('do-not-print');
  });

  it('rejects malformed attempt files with a stable JSON error', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentowners-capabilities-cli-'));
    temporaryDirectories.push(directory);
    const attempts = join(directory, 'attempts.json');
    await writeFile(attempts, JSON.stringify([{ type: 'secret', scope: 'github.token' }]));
    const manifest = await readFile(join(fixtureRoot, 'AGENT_CAPABILITIES.json'), 'utf8');
    const manifestPath = join(directory, 'manifest.json');
    await writeFile(manifestPath, manifest);

    await runCapabilities({ manifest: manifestPath, attempts, output: 'json' });

    expect(process.exitCode).toBe(66);
    expect(JSON.parse(stderr)).toMatchObject({
      status: 'error',
      error: { code: 'INVALID_ATTEMPTS' },
    });
  });
});
