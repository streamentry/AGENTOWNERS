import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'
import { registerValidate } from '../src/commands/validate.js'
import { loadPolicyFile } from '@agent-owners/core'
import { ZodError, ZodIssueCode } from 'zod'

vi.mock('@agent-owners/core', async () => {
  const actual = await vi.importActual<typeof import('@agent-owners/core')>('@agent-owners/core')
  return {
    ...actual,
    loadPolicyFile: vi.fn(),
  }
})

function makeProgram(): Command {
  const p = new Command()
  p.exitOverride()
  registerValidate(p)
  return p
}

describe('validate command', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.mocked(loadPolicyFile).mockClear()
    process.exitCode = undefined
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    process.exitCode = undefined
    vi.restoreAllMocks()
  })

  it('exits 0 and prints success message on valid policy', async () => {
    vi.mocked(loadPolicyFile).mockResolvedValue({
      version: 1,
      defaults: {},
      rules: [],
    } as never)

    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'validate', 'policy.yml'])

    expect(process.exitCode).toBe(0)
    expect(stdoutSpy).toHaveBeenCalledWith('AGENTOWNERS policy valid.\n')
  })

  it('emits a versioned JSON success result', async () => {
    vi.mocked(loadPolicyFile).mockResolvedValue({
      version: 1,
      defaults: {},
      rules: [],
    } as never)

    const program = makeProgram()
    await program.parseAsync([
      'node',
      'agentowners',
      'validate',
      'policy.yml',
      '--output',
      'json',
    ])

    expect(process.exitCode).toBe(0)
    const output = JSON.parse(stdoutSpy.mock.calls.map(([value]) => value).join(''))
    expect(output).toEqual({
      schemaVersion: 1,
      status: 'complete',
      valid: true,
    })
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('uses default path when no path argument given', async () => {
    vi.mocked(loadPolicyFile).mockResolvedValue({
      version: 1,
      defaults: {},
      rules: [],
    } as never)

    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'validate'])

    expect(vi.mocked(loadPolicyFile)).toHaveBeenCalledWith(
      expect.stringContaining('AGENTOWNERS.yml'),
    )
  })

  it('exits 1 and prints error list on ZodError', async () => {
    const zodError = new ZodError([
      {
        code: ZodIssueCode.invalid_enum_value,
        path: ['rules', 0, 'effect'],
        message: 'must be one of allow, require_approval, block',
        options: ['allow', 'require_approval', 'block'],
        received: 'deny',
      },
    ])
    vi.mocked(loadPolicyFile).mockRejectedValue(zodError)

    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'validate', 'bad.yml'])

    expect(process.exitCode).toBe(1)
    expect(stderrSpy).toHaveBeenCalledWith('Invalid AGENTOWNERS policy:\n')
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('rules.0.effect'),
    )
  })

  it('exits 1 and prints error on generic Error', async () => {
    vi.mocked(loadPolicyFile).mockRejectedValue(
      new Error('Failed to load policy from missing.yml: file not found'),
    )

    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'validate', 'missing.yml'])

    expect(process.exitCode).toBe(1)
    expect(stderrSpy).toHaveBeenCalledWith('Invalid AGENTOWNERS policy:\n')
  })

  it('exits 1 and surfaces inner ZodError from PolicyLoadError', async () => {
    const zodError = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        path: ['agents', 'copilot', 'match', 'actors'],
        message: 'Expected array, received string',
        expected: 'array',
        received: 'string',
      },
    ])
    const wrappedErr = Object.assign(
      new Error('Failed to load policy: Expected array, received string'),
      { cause: zodError },
    )
    vi.mocked(loadPolicyFile).mockRejectedValue(wrappedErr)

    const program = makeProgram()
    await program.parseAsync(['node', 'agentowners', 'validate', 'bad.yml'])

    expect(process.exitCode).toBe(1)
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('agents.copilot.match.actors'),
    )
  })

  it('emits structured JSON issues without absolute paths or policy contents', async () => {
    const zodError = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        path: ['agents', 'copilot', 'match', 'actors'],
        message: 'Expected array, received string',
        expected: 'array',
        received: 'string',
      },
    ])
    vi.mocked(loadPolicyFile).mockRejectedValue(
      Object.assign(new Error('Failed to load policy from /private/secret.yml'), {
        cause: zodError,
      }),
    )

    const program = makeProgram()
    await program.parseAsync([
      'node',
      'agentowners',
      'validate',
      '/private/secret.yml',
      '--output',
      'json',
    ])

    expect(process.exitCode).toBe(1)
    const output = JSON.parse(stderrSpy.mock.calls.map(([value]) => value).join(''))
    expect(output).toEqual({
      schemaVersion: 1,
      status: 'error',
      valid: false,
      error: {
        code: 'INVALID_POLICY',
        message: 'Unable to load or validate the policy.',
        issues: [
          {
            path: 'agents.copilot.match.actors',
            message: 'Expected array, received string',
          },
        ],
      },
    })
    expect(stderrSpy.mock.calls.map(([value]) => value).join('')).not.toContain(
      '/private/secret.yml',
    )
  })

  it('redacts received values from Zod diagnostics', async () => {
    const zodError = new ZodError([
      {
        code: ZodIssueCode.invalid_enum_value,
        path: ['defaults', 'unknown_agent'],
        message: "Invalid enum value. Expected 'allow', received 'SCHEMA_SECRET_SENTINEL'",
        options: ['allow'],
        received: 'SCHEMA_SECRET_SENTINEL',
      },
    ])
    vi.mocked(loadPolicyFile).mockRejectedValue(zodError)

    const program = makeProgram()
    await program.parseAsync([
      'node',
      'agentowners',
      'validate',
      'bad.yml',
      '--output',
      'json',
    ])

    const output = stderrSpy.mock.calls.map(([value]) => value).join('')
    expect(output).toContain('defaults.unknown_agent')
    expect(output).toContain('received [REDACTED]')
    expect(output).not.toContain('SCHEMA_SECRET_SENTINEL')
  })

  it('rejects unsupported output formats before loading policy', async () => {
    const program = makeProgram()
    await program.parseAsync([
      'node',
      'agentowners',
      'validate',
      'policy.yml',
      '--output',
      'yaml',
    ])

    expect(process.exitCode).toBe(64)
    expect(vi.mocked(loadPolicyFile)).not.toHaveBeenCalled()
    expect(stderrSpy).toHaveBeenCalledWith('Unsupported output format: yaml\n')
  })

  it('sanitizes generic JSON load errors', async () => {
    vi.mocked(loadPolicyFile).mockRejectedValue(
      new Error('Failed to load policy from /private/secret.yml: token=secret-value'),
    )

    const program = makeProgram()
    await program.parseAsync([
      'node',
      'agentowners',
      'validate',
      '/private/secret.yml',
      '--output',
      'json',
    ])

    const output = JSON.parse(stderrSpy.mock.calls.map(([value]) => value).join(''))
    expect(output.error).toEqual({
      code: 'INVALID_POLICY',
      message: 'Unable to load or validate the policy.',
    })
    expect(stderrSpy.mock.calls.map(([value]) => value).join('')).not.toContain(
      'secret-value',
    )
  })
})
