import { createRequire } from 'node:module';

type PackageMetadata = {
  version?: unknown;
};

const require = createRequire(__filename);
const packageMetadata = require('../package.json') as PackageMetadata;

function requireVersion(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('CLI package metadata must declare a non-empty version.');
  }
  return value;
}

const cliVersion = requireVersion(packageMetadata.version);

/** Return the version shipped in this CLI package. */
export function getCliVersion(): string {
  return cliVersion;
}
