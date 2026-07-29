import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function symlinkRefusal(path: string): Error {
  return new Error(`Refusing to write audit artifact through a symlink: ${path}`);
}

/**
 * Write the Action's audit output without following a checkout-provided link.
 * The no-follow open closes the filesystem race; unsupported runners fail closed.
 */
export async function writeAuditArtifact(content: string): Promise<void> {
  const artifactPath = 'agentowners-decision.json';
  const noFollow = constants.O_NOFOLLOW;
  if (noFollow === undefined) {
    throw new Error('Runner does not support safe no-follow audit artifact writes.');
  }
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | noFollow;
  let handle;
  try {
    handle = await open(artifactPath, flags, 0o600);
  } catch (error: unknown) {
    if (errorCode(error) === 'ELOOP') throw symlinkRefusal(artifactPath);
    throw error;
  }

  try {
    await handle.chmod(0o600);
    await handle.writeFile(content, 'utf8');
  } finally {
    await handle.close();
  }
}
