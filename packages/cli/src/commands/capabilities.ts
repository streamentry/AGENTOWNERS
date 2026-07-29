import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { Command } from 'commander';
import {
  evaluateCapabilities,
  hashCapabilityManifest,
  parseCapabilityAttempts,
  parseCapabilityManifest,
  verifyCapabilityAudit,
  type CapabilityAuditVerification,
  type CapabilityEvaluationResult,
} from '@agent-owners/core';

type CapabilityOptions = {
  manifest?: string;
  attempts?: string;
  output: string;
  failOnDeny?: boolean;
};

type ResolvedCapabilityOptions = {
  manifest: string;
  attempts: string;
  output: 'text' | 'json';
  failOnDeny: boolean;
};

type AuditVerificationOptions = {
  audit: string;
  manifest?: string;
  output: string;
};

type CapabilityErrorCode =
  'INVALID_INPUT' | 'INVALID_MANIFEST' | 'INVALID_ATTEMPTS' | 'INVALID_AUDIT' | 'INTERNAL_ERROR';

const errorDetails: Record<CapabilityErrorCode, { exitCode: number; message: string }> = {
  INVALID_INPUT: { exitCode: 64, message: 'Invalid capability command input.' },
  INVALID_MANIFEST: { exitCode: 65, message: 'Unable to load or validate capability manifest.' },
  INVALID_ATTEMPTS: { exitCode: 66, message: 'Unable to load or validate capability attempts.' },
  INVALID_AUDIT: { exitCode: 65, message: 'Unable to load or validate capability audit.' },
  INTERNAL_ERROR: { exitCode: 70, message: 'Capability evaluation failed unexpectedly.' },
};

function writeError(code: CapabilityErrorCode, output: string, detail?: string): void {
  const error = errorDetails[code];
  if (output === 'json') {
    process.stderr.write(
      `${JSON.stringify({
        schemaVersion: 1,
        status: 'error',
        error: { code, message: error.message, ...(detail ? { detail } : {}) },
      })}\n`,
    );
  } else {
    process.stderr.write(`${detail ?? error.message}\n`);
  }
  process.exitCode = error.exitCode;
}

function resolveOptions(options: CapabilityOptions): ResolvedCapabilityOptions | null {
  const output = options.output;
  if (output !== 'text' && output !== 'json') {
    writeError('INVALID_INPUT', output, `Unsupported output format: ${output}`);
    return null;
  }
  const missing = [
    !options.manifest ? '--manifest' : null,
    !options.attempts ? '--attempts' : null,
  ].filter((value): value is string => value !== null);
  if (missing.length > 0) {
    writeError('INVALID_INPUT', output, `Missing required options: ${missing.join(', ')}`);
    return null;
  }
  return {
    manifest: path.resolve(process.cwd(), options.manifest as string),
    attempts: path.resolve(process.cwd(), options.attempts as string),
    output,
    failOnDeny: options.failOnDeny === true,
  };
}

async function readJson(
  filePath: string,
  code: CapabilityErrorCode,
  output: string,
): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  } catch {
    writeError(code, output);
    return null;
  }
}

function writeText(result: CapabilityEvaluationResult): void {
  const { attempts, allowed, denied, kill_triggered: killTriggered } = result.summary;
  process.stdout.write(
    `Capability evaluation complete.\n${attempts} attempts: ${allowed} allowed, ${denied} denied.\nKill triggered: ${killTriggered}.\n`,
  );
}

function writeResult(
  result: CapabilityEvaluationResult,
  output: 'text' | 'json',
  failOnDeny: boolean,
): void {
  if (output === 'json') {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    writeText(result);
  }
  process.exitCode = failOnDeny && result.summary.denied > 0 ? 1 : 0;
}

function writeAuditVerification(
  verification: CapabilityAuditVerification,
  output: 'text' | 'json',
): void {
  if (output === 'json') {
    process.stdout.write(
      `${JSON.stringify({ schemaVersion: 1, status: 'complete', verification }, null, 2)}\n`,
    );
  } else if (verification.valid) {
    process.stdout.write(
      `Capability audit verified.\n${verification.eventsChecked} events checked.\nDigest: ${verification.auditDigest}.\n`,
    );
  } else {
    process.stdout.write(
      `Capability audit verification failed.\nCode: ${verification.code}.\n${verification.eventsChecked} events checked.\n`,
    );
  }
  process.exitCode = verification.valid ? 0 : 1;
}

export async function runCapabilities(rawOptions: CapabilityOptions): Promise<void> {
  const options = resolveOptions(rawOptions);
  if (!options) return;
  const manifest = await readJson(options.manifest, 'INVALID_MANIFEST', options.output);
  if (manifest === null) return;
  const attempts = await readJson(options.attempts, 'INVALID_ATTEMPTS', options.output);
  if (attempts === null) return;
  let parsedManifest: ReturnType<typeof parseCapabilityManifest>;
  try {
    parsedManifest = parseCapabilityManifest(manifest);
  } catch {
    writeError('INVALID_MANIFEST', options.output);
    return;
  }
  let parsedAttempts: ReturnType<typeof parseCapabilityAttempts>;
  try {
    parsedAttempts = parseCapabilityAttempts(attempts);
  } catch {
    writeError('INVALID_ATTEMPTS', options.output);
    return;
  }
  try {
    writeResult(
      evaluateCapabilities(parsedManifest, parsedAttempts),
      options.output,
      options.failOnDeny,
    );
  } catch {
    writeError('INTERNAL_ERROR', options.output);
  }
}

export async function runVerifyCapabilityAudit(options: AuditVerificationOptions): Promise<void> {
  if (options.output !== 'text' && options.output !== 'json') {
    writeError('INVALID_INPUT', options.output, `Unsupported output format: ${options.output}`);
    return;
  }
  const auditPath = path.resolve(process.cwd(), options.audit);
  const audit = await readJson(auditPath, 'INVALID_AUDIT', options.output);
  if (audit === null) return;
  let expectedManifestDigest: string | undefined;
  if (options.manifest !== undefined) {
    const manifestPath = path.resolve(process.cwd(), options.manifest);
    const manifest = await readJson(manifestPath, 'INVALID_MANIFEST', options.output);
    if (manifest === null) return;
    try {
      expectedManifestDigest = hashCapabilityManifest(parseCapabilityManifest(manifest));
    } catch {
      writeError('INVALID_MANIFEST', options.output);
      return;
    }
  }
  try {
    writeAuditVerification(verifyCapabilityAudit(audit, expectedManifestDigest), options.output);
  } catch {
    writeError('INTERNAL_ERROR', options.output);
  }
}

export function registerCapabilities(program: Command): void {
  const capabilities = program
    .command('capabilities')
    .description('Evaluate a pre-dispatch capability manifest and audit attempts')
    .option('--manifest <path>', 'Path to a JSON capability manifest')
    .option('--attempts <path>', 'Path to a JSON array of capability attempts')
    .option('--output <format>', 'Output format: text | json', 'text')
    .option('--fail-on-deny', 'Exit one when any attempt is denied')
    .action(runCapabilities);

  capabilities
    .command('verify-audit')
    .description('Verify a hash-chained capability audit JSON file')
    .requiredOption('--audit <path>', 'Path to a capability evaluation result JSON file')
    .option('--manifest <path>', 'Bind verification to this capability manifest JSON file')
    .option('--format <format>', 'Output format: text | json', 'text')
    .action((options: { audit: string; manifest?: string; format: string }) =>
      runVerifyCapabilityAudit({
        audit: options.audit,
        manifest: options.manifest,
        output: options.format,
      }),
    );
}
