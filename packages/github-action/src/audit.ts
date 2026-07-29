import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';

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
 * The no-follow open closes the lstat/write race on platforms that support it.
 */
export async function writeAuditArtifact(artifactPath: string, content: string): Promise<void> {
  try {
    const metadata = await lstat(artifactPath);
    if (metadata.isSymbolicLink()) throw symlinkRefusal(artifactPath);
  } catch (error: unknown) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }

  const noFollow = constants.O_NOFOLLOW ?? 0;
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | noFollow;
  let handle;
  try {
    handle = await open(artifactPath, flags, 0o600);
  } catch (error: unknown) {
    if (errorCode(error) === 'ELOOP') throw symlinkRefusal(artifactPath);
    throw error;
  }

  try {
    await handle.writeFile(content, 'utf8');
  } finally {
    await handle.close();
  }
}
