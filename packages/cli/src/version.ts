import { createRequire } from 'node:module'

type PackageMetadata = {
  version?: unknown
}

const require = createRequire(__filename)
const packageMetadata = require('../package.json') as PackageMetadata

if (typeof packageMetadata.version !== 'string' || packageMetadata.version.length === 0) {
  throw new Error('CLI package metadata must contain a non-empty version.')
}

export const cliVersion = packageMetadata.version
