import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadPolicyFile } from '../src/loader.js'

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')

describe('repository policy files', () => {
  it.each(['.github/AGENTOWNERS.yml', '.github/AGENTOWNERS.yml.example'])(
    'accepts %s with the current strict schema',
    async (relativePath) => {
      const policy = await loadPolicyFile(path.join(repositoryRoot, relativePath))

      expect(policy.version).toBe(1)
    },
  )
})
