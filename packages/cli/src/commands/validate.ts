import * as path from 'path'
import { Command } from 'commander'
import { loadPolicyFile } from '@agent-owners/core'
import { ZodError } from 'zod'

type ValidateOptions = {
  output: string
}

type ValidateIssue = {
  path: string
  message: string
}

function findZodError(error: unknown): ZodError | null {
  if (error instanceof ZodError) return error

  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause
    if (cause instanceof ZodError) return cause
  }

  return null
}

function getIssues(error: unknown): ValidateIssue[] | null {
  const zodError = findZodError(error)
  if (!zodError) return null

  return zodError.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))
}

function writeJsonSuccess(): void {
  process.stdout.write(
    `${JSON.stringify({ schemaVersion: 1, status: 'complete', valid: true }, null, 2)}\n`,
  )
  process.exitCode = 0
}

function writeJsonError(error: unknown): void {
  const issues = getIssues(error)
  process.stderr.write(
    `${JSON.stringify(
      {
        schemaVersion: 1,
        status: 'error',
        valid: false,
        error: {
          code: 'INVALID_POLICY',
          message: 'Unable to load or validate the policy.',
          ...(issues ? { issues } : {}),
        },
      },
      null,
      2,
    )}\n`,
  )
  process.exitCode = 1
}

function writeTextError(error: unknown): void {
  process.stderr.write('Invalid AGENTOWNERS policy:\n')

  const zodError = findZodError(error)
  if (zodError) {
    for (const issue of zodError.issues) {
      process.stderr.write(`- ${issue.path.join('.')} ${issue.message}\n`)
    }
  } else if (error instanceof Error) {
    process.stderr.write(`- ${error.message}\n`)
  } else {
    process.stderr.write(`- ${String(error)}\n`)
  }
}

export function registerValidate(program: Command): void {
  program
    .command('validate [policy-path]')
    .description('Validate an AGENTOWNERS policy file')
    .option('--output <format>', 'Output format: text | json', 'text')
    .action(async (policyPath: string | undefined, options: ValidateOptions) => {
      if (options.output !== 'text' && options.output !== 'json') {
        process.stderr.write(`Unsupported output format: ${options.output}\n`)
        process.exitCode = 64
        return
      }

      const resolved = path.resolve(
        process.cwd(),
        policyPath ?? '.github/AGENTOWNERS.yml',
      )

      try {
        await loadPolicyFile(resolved)
        if (options.output === 'json') {
          writeJsonSuccess()
        } else {
          process.stdout.write('AGENTOWNERS policy valid.\n')
          process.exitCode = 0
        }
      } catch (err: unknown) {
        if (options.output === 'json') {
          writeJsonError(err)
        } else {
          writeTextError(err)
          process.exitCode = 1
        }
      }
    })
}
