import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Command } from 'commander'
import { registerValidate } from '../src/commands/validate.js'

function makeProgram(): Command {
  const program = new Command()
  program.exitOverride()
  registerValidate(program)
  return program
}

describe('validate command integration', () => {
  let tempDir: string
  let stdout = ''
  let stderr = ''

  beforeEach(async () => {
    process.exitCode = undefined
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'agentowners-validate-'))
    stdout = ''
    stderr = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += String(chunk)
      return true
    })
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += String(chunk)
      return true
    })
  })

  afterEach(async () => {
    process.exitCode = undefined
    vi.restoreAllMocks()
    await rm(tempDir, { recursive: true, force: true })
  })

  it('loads a real policy file and emits the documented JSON contract', async () => {
    const policyPath = path.join(tempDir, 'AGENTOWNERS.yml')
    await writeFile(policyPath, 'version: 1\ndefaults: {}\nrules: []\n', 'utf8')

    await makeProgram().parseAsync([
      'node',
      'agentowners',
      'validate',
      policyPath,
      '--output',
      'json',
    ])

    expect(JSON.parse(stdout)).toEqual({
      schemaVersion: 1,
      status: 'complete',
      valid: true,
    })
    expect(stdout).not.toContain(policyPath)
    expect(stderr).toBe('')
    expect(process.exitCode).toBe(0)
  })
})
