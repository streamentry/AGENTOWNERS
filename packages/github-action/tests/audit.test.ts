import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeAuditArtifact } from '../src/audit.js';

describe('writeAuditArtifact', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'agentowners-audit-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('creates a regular audit artifact', async () => {
    const artifactPath = join(directory, 'agentowners-decision.json');

    await writeAuditArtifact(artifactPath, '{"decision":"allow"}');

    await expect(readFile(artifactPath, 'utf8')).resolves.toBe('{"decision":"allow"}');
    const mode = (await stat(artifactPath)).mode & 0o777;
    expect(mode & 0o077).toBe(0);
  });

  it('rewrites an existing regular artifact', async () => {
    const artifactPath = join(directory, 'agentowners-decision.json');
    await writeFile(artifactPath, '{"decision":"allow"}', 'utf8');

    await writeAuditArtifact(artifactPath, '{"decision":"block"}');

    await expect(readFile(artifactPath, 'utf8')).resolves.toBe('{"decision":"block"}');
  });

  it('rejects a symlink without writing through it', async () => {
    const targetPath = join(directory, 'target.txt');
    const artifactPath = join(directory, 'agentowners-decision.json');
    await writeFile(targetPath, 'keep this file', 'utf8');
    await symlink(targetPath, artifactPath);

    await expect(writeAuditArtifact(artifactPath, '{"decision":"block"}')).rejects.toThrow(
      'Refusing to write audit artifact through a symlink',
    );
    await expect(readFile(targetPath, 'utf8')).resolves.toBe('keep this file');
  });
});
