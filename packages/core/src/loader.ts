import * as fs from 'fs/promises'
import * as path from 'path'
import * as yaml from 'js-yaml'
import { parsePolicy } from './schema.js'
import type { AgentOwnersPolicy } from './types.js'

const POLICY_FILE_NAMES = [
  '.github/AGENTOWNERS.yml',
  'AGENTOWNERS.yml',
  '.agentowners.yml',
]

export class PolicyNotFoundError extends Error {
  constructor(public searchedPaths: string[]) {
    super(`No AGENTOWNERS policy found. Searched: ${searchedPaths.join(', ')}`)
    this.name = 'PolicyNotFoundError'
  }
}

export class PolicyLoadError extends Error {
  constructor(
    public filePath: string,
    public override cause: unknown,
    safeCauseMessage?: string,
  ) {
    const causeMsg = safeCauseMessage ?? (cause instanceof Error ? cause.message : String(cause))
    super(`Failed to load policy from ${filePath}: ${causeMsg}`)
    this.name = 'PolicyLoadError'
  }
}

function yamlErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const mark = (error as { mark?: { line?: unknown; column?: unknown } }).mark
    if (typeof mark?.line === 'number' && typeof mark.column === 'number') {
      return `Invalid YAML syntax at line ${mark.line + 1}, column ${mark.column + 1}.`
    }
  }
  return 'Invalid YAML syntax.'
}

export async function findPolicyFile(cwd: string): Promise<string | null> {
  const found: string[] = []

  for (const name of POLICY_FILE_NAMES) {
    const candidate = path.join(cwd, name)
    try {
      await fs.access(candidate)
      found.push(candidate)
    } catch {
      // file does not exist — continue
    }
  }

  if (found.length === 0) {
    return null
  }

  if (found.length > 1) {
    process.stderr.write(
      `[agentowners] Warning: multiple policy files found. Using ${found[0]}. Others ignored: ${found.slice(1).join(', ')}\n`,
    )
  }

  return found[0]
}

export async function loadPolicyFile(filePath: string): Promise<AgentOwnersPolicy> {
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch (err) {
    throw new PolicyLoadError(filePath, err)
  }

  return loadPolicyText(raw, filePath)
}

export function loadPolicyText(raw: string, source = 'policy text'): AgentOwnersPolicy {
  let parsed: unknown
  try {
    parsed = yaml.load(raw)
  } catch (err) {
    throw new PolicyLoadError(source, err, yamlErrorMessage(err))
  }

  try {
    return parsePolicy(parsed)
  } catch (err) {
    throw new PolicyLoadError(source, err, 'Policy does not match the AGENTOWNERS schema.')
  }
}

export async function loadPolicy(
  cwd: string,
): Promise<{ policy: AgentOwnersPolicy; filePath: string }> {
  const searchedPaths = POLICY_FILE_NAMES.map((name) => path.join(cwd, name))
  const filePath = await findPolicyFile(cwd)

  if (filePath === null) {
    throw new PolicyNotFoundError(searchedPaths)
  }

  const policy = await loadPolicyFile(filePath)
  return { policy, filePath }
}
