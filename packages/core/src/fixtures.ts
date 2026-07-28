import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { classifyFiles } from './classifier.js';
import { detectAgent } from './detection.js';
import { inferActions } from './actions.js';
import { evaluatePolicy } from './evaluator.js';
import { agentActionSchema } from './schema.js';
import type {
  AgentOwnersPolicy,
  Decision,
  PolicyFixtureAssertionFailure,
  PolicyFixtureCase,
  PolicyFixtureCaseResult,
  PolicyFixtureExpectation,
  PolicyFixtureSuite,
  PolicyFixtureSuiteResult,
} from './types.js';

const eventSchema = z.enum([
  'pull_request.opened',
  'pull_request.synchronize',
  'pull_request.reopened',
  'pull_request.ready_for_review',
  'issue_comment.created',
  'issue_comment.edited',
  'pull_request_review.submitted',
  'issues.labeled',
  'issues.closed',
  'issues.reopened',
  'issues.opened',
]);

const repositoryPathSchema = z.string().refine(isRepositoryPath, {
  message: 'Expected a repository-relative Git path',
});

const uniqueStrings = z
  .array(z.string())
  .refine((values) => new Set(values).size === values.length, {
    message: 'Expected unique values',
  });

const fixtureInputSchema = z
  .object({
    event: eventSchema,
    actor: z.string().trim().min(1),
    changed_files: z
      .array(repositoryPathSchema)
      .refine(uniqueValues, { message: 'Expected unique values' })
      .default([]),
    commit_messages: z.array(z.string()).default([]),
    commit_emails: z.array(z.string()).default([]),
    commit_names: z.array(z.string()).default([]),
    labels: z.array(z.string()).default([]),
    pr_title: z.string().optional(),
    pr_body: z.string().optional(),
    issue_title: z.string().optional(),
    issue_body: z.string().optional(),
    review_state: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED']).optional(),
    diff_lines_count: z.number().int().nonnegative().optional(),
    commits_count: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.review_state && input.event !== 'pull_request_review.submitted') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['review_state'],
        message: 'review_state requires pull_request_review.submitted',
      });
    }
    const isPullRequestEvent =
      input.event.startsWith('pull_request.') || input.event === 'pull_request_review.submitted';
    if (!isPullRequestEvent && input.changed_files.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['changed_files'],
        message: 'changed_files requires a pull request event',
      });
    }
    if (!isPullRequestEvent && input.commit_messages.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['commit_messages'],
        message: 'commit_messages requires a pull request event',
      });
    }
    for (const field of ['commit_emails', 'commit_names'] as const) {
      if (!isPullRequestEvent && input[field].length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} requires a pull request event`,
        });
      }
    }
    for (const field of ['diff_lines_count', 'commits_count'] as const) {
      if (!isPullRequestEvent && input[field] !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} requires a pull request event`,
        });
      }
    }
    const hasPullRequestMetadata =
      isPullRequestEvent || input.event.startsWith('issue_comment.');
    for (const field of ['pr_title', 'pr_body'] as const) {
      if (!hasPullRequestMetadata && input[field] !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} requires a pull request context`,
        });
      }
    }
    const hasIssueMetadata =
      input.event.startsWith('issues.') || input.event.startsWith('issue_comment.');
    for (const field of ['issue_title', 'issue_body'] as const) {
      if (!hasIssueMetadata && input[field] !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} requires an issue context`,
        });
      }
    }
    const hasPrFields = input.pr_title !== undefined || input.pr_body !== undefined;
    const hasIssueFields = input.issue_title !== undefined || input.issue_body !== undefined;
    if (input.event.startsWith('issue_comment.') && hasPrFields && hasIssueFields) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'issue comments cannot contain both pull request and issue metadata',
      });
    }
  });

const fixtureExpectationSchema = z
  .object({
    decision: z.enum(['allow', 'require_approval', 'block']),
    matched_rules: uniqueStrings.optional(),
    matched_agent: z.string().min(1).nullable().optional(),
    detected_actions: z
      .array(agentActionSchema)
      .refine(uniqueValues, {
        message: 'Expected unique values',
      })
      .optional(),
    required_reviewers: uniqueStrings.optional(),
    labels: uniqueStrings.optional(),
    risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    risk_score: z.number().int().min(0).max(100).optional(),
  })
  .strict();

const fixtureCaseSchema = z
  .object({
    name: z.string().trim().min(1),
    input: fixtureInputSchema,
    expect: fixtureExpectationSchema,
  })
  .strict();

export const policyFixtureSuiteSchema = z
  .object({
    version: z.literal(1),
    cases: z.array(fixtureCaseSchema).min(1),
  })
  .strict()
  .superRefine((suite, context) => {
    const names = suite.cases.map((fixture) => fixture.name);
    if (new Set(names).size !== names.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cases'],
        message: 'Fixture case names must be unique',
      });
    }
  });

export function parsePolicyFixtureSuite(input: unknown): PolicyFixtureSuite {
  return policyFixtureSuiteSchema.parse(input) as PolicyFixtureSuite;
}

export class PolicyFixtureLoadError extends Error {
  constructor(
    public filePath: string,
    public override cause: unknown,
  ) {
    super(`Failed to load policy fixtures from ${filePath}`);
    this.name = 'PolicyFixtureLoadError';
  }
}

export async function loadPolicyFixtureFile(filePath: string): Promise<PolicyFixtureSuite> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return parsePolicyFixtureSuite(yaml.load(raw));
  } catch (error: unknown) {
    throw new PolicyFixtureLoadError(filePath, error);
  }
}

export function runPolicyFixtureSuite(
  policy: AgentOwnersPolicy,
  suite: PolicyFixtureSuite,
): PolicyFixtureSuiteResult {
  const cases = suite.cases.map((fixture) => runFixtureCase(policy, fixture));
  const passedCount = cases.filter((fixture) => fixture.passed).length;
  const failedCount = cases.length - passedCount;
  return {
    passed: failedCount === 0,
    total: cases.length,
    passedCount,
    failedCount,
    cases,
  };
}

function runFixtureCase(
  policy: AgentOwnersPolicy,
  fixture: PolicyFixtureCase,
): PolicyFixtureCaseResult {
  const filesClassification = classifyFiles(fixture.input.changed_files);
  const agentDetection = detectAgent({
    actor: fixture.input.actor,
    commitMessages: fixture.input.commit_messages,
    commitEmails: fixture.input.commit_emails,
    commitNames: fixture.input.commit_names,
    prTitle: fixture.input.pr_title,
    prBody: fixture.input.pr_body,
    issueBody: fixture.input.issue_body,
    labels: fixture.input.labels,
    policy,
  });
  const detectedActions = inferActions({
    eventType: fixture.input.event,
    changedFiles: fixture.input.changed_files,
    reviewState: fixture.input.review_state,
    filesClassification,
  });
  const decision = evaluatePolicy({
    policy,
    agentDetection,
    detectedActions,
    changedFiles: fixture.input.changed_files,
    filesClassification,
    diffLinesCount: fixture.input.diff_lines_count,
    commitsCount: fixture.input.commits_count,
    actor: fixture.input.actor,
    prTitle: fixture.input.pr_title,
    prBody: fixture.input.pr_body,
    issueTitle: fixture.input.issue_title,
    issueBody: fixture.input.issue_body,
    labels: fixture.input.labels,
  });
  const failures = compareExpectation(fixture.expect, decision);
  return { name: fixture.name, passed: failures.length === 0, failures };
}

function compareExpectation(
  expected: PolicyFixtureExpectation,
  decision: Decision,
): PolicyFixtureAssertionFailure[] {
  const actual: PolicyFixtureExpectation = {
    decision: decision.effect,
    matched_rules: decision.matchedRules.map((rule) => rule.name),
    matched_agent: decision.matchedAgent ?? null,
    detected_actions: decision.detectedActions,
    required_reviewers: decision.requiredReviewers,
    labels: decision.labelsToApply,
    risk_level: decision.riskLevel,
    risk_score: decision.riskScore,
  };
  const failures: PolicyFixtureAssertionFailure[] = [];
  for (const field of EXPECTATION_FIELDS) {
    if (expected[field] === undefined) continue;
    const expectedValue = normalizeExpectation(field, expected[field]);
    const actualValue = normalizeExpectation(field, actual[field]);
    if (JSON.stringify(expectedValue) !== JSON.stringify(actualValue)) {
      failures.push({ field, expected: expectedValue, actual: actualValue });
    }
  }
  return failures;
}

const EXPECTATION_FIELDS: Array<keyof PolicyFixtureExpectation> = [
  'decision',
  'matched_rules',
  'matched_agent',
  'detected_actions',
  'required_reviewers',
  'labels',
  'risk_level',
  'risk_score',
];

function normalizeExpectation(field: keyof PolicyFixtureExpectation, value: unknown): unknown {
  return ARRAY_FIELDS.has(field) && Array.isArray(value) ? [...value].sort() : value;
}

const ARRAY_FIELDS = new Set<keyof PolicyFixtureExpectation>([
  'matched_rules',
  'detected_actions',
  'required_reviewers',
  'labels',
]);

function uniqueValues(values: unknown[]): boolean {
  return new Set(values).size === values.length;
}

function isRepositoryPath(value: string): boolean {
  if (value.length === 0 || value.includes('\0') || value.includes('\\')) return false;
  if (value.startsWith('/') || /^[a-z]:\//i.test(value)) return false;
  const segments = value.split('/');
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}
