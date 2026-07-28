import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { cliVersion } from '../src/version.js'

type PackageMetadata = {
  version?: unknown
}

const require = createRequire(import.meta.url)

describe('CLI version metadata', () => {
  it('uses the package version as the command version', () => {
    const packageMetadata = require('../package.json') as PackageMetadata

    expect(typeof packageMetadata.version).toBe('string')
    expect(cliVersion).toBe(packageMetadata.version)
  })
})
