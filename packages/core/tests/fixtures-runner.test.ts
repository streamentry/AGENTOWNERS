import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadPolicyFixtureFile,
  parsePolicyFixtureSuite,
  parsePolicy,
  runPolicyFixtureSuite,
} from '../src/index.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

const policy = parsePolicy({
  version: 1,
  agents: {
    copilot: {
      match: { actors: ['github-copilot[bot]'] },
      allowed: ['open_pr', 'modify_docs'],
      blocked: ['edit_workflows'],
    },
  },
  defaults: {
    known_agent: 'require_approval',
    unknown_agent: 'require_approval',
    docs_only: 'allow',
    workflows: 'block',
  },
  rules: [
    {
      name: 'Block workflows',
      when: { changes_workflows: true },
      effect: 'block',
      reviewers: ['@security'],
      labels: ['security-review'],
      reason: 'Workflow changes alter privileged automation.',
    },
  ],
});

function validSuite() {
  return {
    version: 1,
    cases: [
      {
        name: 'docs are allowed',
        input: {
          event: 'pull_request.opened',
          actor: 'github-copilot[bot]',
          changed_files: ['docs/guide.md'],
        },
        expect: {
          decision: 'allow',
          matched_agent: 'copilot',
          detected_actions: ['modify_docs', 'open_pr'],
          risk_level: 'low',
        },
      },
    ],
  };
}

describe('parsePolicyFixtureSuite', () => {
  it('parses a strict versioned suite and supplies deterministic defaults', () => {
    const suite = parsePolicyFixtureSuite(validSuite());

    expect(suite).toEqual({
      ...validSuite(),
      cases: [
        {
          ...validSuite().cases[0],
          input: {
            ...validSuite().cases[0]?.input,
            commit_messages: [],
            labels: [],
          },
        },
      ],
    });
  });

  it('rejects unknown keys and duplicate case names', () => {
    const unknown = validSuite();
    Object.assign(unknown.cases[0]!.input, { actions: ['open_pr'] });
    expect(() => parsePolicyFixtureSuite(unknown)).toThrow();

    const duplicate = validSuite();
    duplicate.cases.push({
      ...duplicate.cases[0]!,
      input: { ...duplicate.cases[0]!.input },
      expect: { ...duplicate.cases[0]!.expect },
    });
    expect(() => parsePolicyFixtureSuite(duplicate)).toThrow('Fixture case names must be unique');
  });

  it.each([
    '/etc/passwd',
    '../policy.yml',
    'src/../secret.ts',
    'C:/secrets.txt',
    'src\\secret.ts',
    'src//file.ts',
    'src/./file.ts',
    'src/\u0000secret.ts',
  ])('rejects unsafe repository path %j', (unsafePath) => {
    const suite = validSuite();
    suite.cases[0]!.input.changed_files = [unsafePath];
    expect(() => parsePolicyFixtureSuite(suite)).toThrow('repository-relative Git path');
  });

  it('rejects review state on events where GitHub cannot supply it', () => {
    const suite = validSuite();
    Object.assign(suite.cases[0]!.input, { review_state: 'APPROVED' });
    expect(() => parsePolicyFixtureSuite(suite)).toThrow(
      'review_state requires pull_request_review.submitted',
    );
  });

  it('rejects blank actors and duplicate changed files', () => {
    const blankActor = validSuite();
    blankActor.cases[0]!.input.actor = '   ';
    expect(() => parsePolicyFixtureSuite(blankActor)).toThrow();

    const duplicateFile = validSuite();
    duplicateFile.cases[0]!.input.changed_files = ['docs/guide.md', 'docs/guide.md'];
    expect(() => parsePolicyFixtureSuite(duplicateFile)).toThrow('Expected unique values');
  });

  it('rejects changed files on events whose production adapter cannot supply them', () => {
    const suite = validSuite();
    suite.cases[0]!.input.event = 'issues.opened';
    expect(() => parsePolicyFixtureSuite(suite)).toThrow(
      'changed_files requires a pull request event',
    );
  });

  it.each(['pr_title', 'pr_body'] as const)(
    'rejects %s on issue events whose production adapter cannot supply PR metadata',
    (field) => {
      const suite = validSuite();
      suite.cases[0]!.input.event = 'issues.opened';
      suite.cases[0]!.input.changed_files = [];
      Object.assign(suite.cases[0]!.input, { [field]: 'unreachable PR metadata' });

      expect(() => parsePolicyFixtureSuite(suite)).toThrow(
        `${field} requires a pull request context`,
      );
    },
  );

  it.each(['issue_title', 'issue_body'] as const)(
    'rejects %s on pull request events whose production adapter cannot supply issue metadata',
    (field) => {
      const suite = validSuite();
      Object.assign(suite.cases[0]!.input, { [field]: 'unreachable issue metadata' });

      expect(() => parsePolicyFixtureSuite(suite)).toThrow(
        `${field} requires an issue context`,
      );
    },
  );

  it('rejects mutually exclusive PR and issue metadata on issue comments', () => {
    const suite = validSuite();
    suite.cases[0]!.input.event = 'issue_comment.created';
    suite.cases[0]!.input.changed_files = [];
    Object.assign(suite.cases[0]!.input, {
      pr_title: 'pull request target',
      issue_title: 'issue target',
    });

    expect(() => parsePolicyFixtureSuite(suite)).toThrow(
      'issue comments cannot contain both pull request and issue metadata',
    );
  });

  it.each(['diff_lines_count', 'commits_count'] as const)(
    'rejects %s outside pull request events',
    (field) => {
      const suite = validSuite();
      suite.cases[0]!.input.event = 'issue_comment.created';
      suite.cases[0]!.input.changed_files = [];
      Object.assign(suite.cases[0]!.input, { [field]: 1 });

      expect(() => parsePolicyFixtureSuite(suite)).toThrow(
        `${field} requires a pull request event`,
      );
    },
  );

  it('rejects commit messages outside pull request events', () => {
    const suite = validSuite();
    suite.cases[0]!.input.event = 'issues.opened';
    suite.cases[0]!.input.changed_files = [];
    Object.assign(suite.cases[0]!.input, { commit_messages: ['unreachable commit'] });

    expect(() => parsePolicyFixtureSuite(suite)).toThrow(
      'commit_messages requires a pull request event',
    );
  });

  it('loads and validates a portable YAML suite from disk', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentowners-fixtures-'));
    temporaryDirectories.push(directory);
    const fixturePath = join(directory, 'fixtures.yml');
    await writeFile(
      fixturePath,
      [
        'version: 1',
        'cases:',
        '  - name: docs are allowed',
        '    input:',
        '      event: pull_request.opened',
        '      actor: github-copilot[bot]',
        '      changed_files: [docs/guide.md]',
        '    expect:',
        '      decision: allow',
      ].join('\n'),
      'utf8',
    );

    await expect(loadPolicyFixtureFile(fixturePath)).resolves.toMatchObject({
      version: 1,
      cases: [{ name: 'docs are allowed' }],
    });
  });

  it('wraps malformed YAML without exposing its contents in the error message', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'agentowners-fixtures-'));
    temporaryDirectories.push(directory);
    const fixturePath = join(directory, 'fixtures.yml');
    await writeFile(fixturePath, 'secret-value: [', 'utf8');

    await expect(loadPolicyFixtureFile(fixturePath)).rejects.toMatchObject({
      name: 'PolicyFixtureLoadError',
      message: `Failed to load policy fixtures from ${fixturePath}`,
    });
  });
});

describe('runPolicyFixtureSuite', () => {
  it('evaluates complete cases through detection, classification, inference, and policy', () => {
    const suite = parsePolicyFixtureSuite({
      version: 1,
      cases: [
        validSuite().cases[0],
        {
          name: 'workflows are blocked',
          input: {
            event: 'pull_request.opened',
            actor: 'github-copilot[bot]',
            changed_files: ['.github/workflows/release.yml'],
          },
          expect: {
            decision: 'block',
            matched_rules: ['Agent policy: copilot', 'Block workflows'],
            required_reviewers: ['@security'],
            labels: ['ai-agent', 'risk-critical', 'security-review'],
          },
        },
      ],
    });

    expect(runPolicyFixtureSuite(policy, suite)).toEqual({
      passed: true,
      total: 2,
      passedCount: 2,
      failedCount: 0,
      cases: [
        { name: 'docs are allowed', passed: true, failures: [] },
        { name: 'workflows are blocked', passed: true, failures: [] },
      ],
    });
  });

  it('compares semantically unordered arrays as sets', () => {
    const suite = parsePolicyFixtureSuite({
      version: 1,
      cases: [
        {
          name: 'unordered expectations',
          input: {
            event: 'pull_request.opened',
            actor: 'github-copilot[bot]',
            changed_files: ['.github/workflows/release.yml'],
          },
          expect: {
            decision: 'block',
            matched_rules: ['Block workflows', 'Agent policy: copilot'],
            labels: ['security-review', 'risk-critical', 'ai-agent'],
          },
        },
      ],
    });

    expect(runPolicyFixtureSuite(policy, suite).passed).toBe(true);
  });

  it('reports every failed assertion in stable field order', () => {
    const suite = parsePolicyFixtureSuite({
      version: 1,
      cases: [
        {
          name: 'wrong expectations',
          input: {
            event: 'pull_request.opened',
            actor: 'github-copilot[bot]',
            changed_files: ['docs/guide.md'],
          },
          expect: {
            decision: 'block',
            matched_agent: 'other-agent',
            risk_score: 99,
          },
        },
      ],
    });

    expect(runPolicyFixtureSuite(policy, suite)).toEqual({
      passed: false,
      total: 1,
      passedCount: 0,
      failedCount: 1,
      cases: [
        {
          name: 'wrong expectations',
          passed: false,
          failures: [
            { field: 'decision', expected: 'block', actual: 'allow' },
            { field: 'matched_agent', expected: 'other-agent', actual: 'copilot' },
            { field: 'risk_score', expected: 99, actual: 5 },
          ],
        },
      ],
    });
  });

  it('supports review-state action inference without accepting manual actions', () => {
    const suite = parsePolicyFixtureSuite({
      version: 1,
      cases: [
        {
          name: 'agent approval',
          input: {
            event: 'pull_request_review.submitted',
            actor: 'github-copilot[bot]',
            changed_files: [],
            review_state: 'APPROVED',
          },
          expect: {
            decision: 'require_approval',
            detected_actions: ['approve_pr', 'review_comment'],
          },
        },
      ],
    });

    expect(runPolicyFixtureSuite(policy, suite).passed).toBe(true);
  });

  it('evaluates issue-only rule fields on compatible issue events', () => {
    const issuePolicy = parsePolicy({
      version: 1,
      defaults: {
        known_agent: 'allow',
        unknown_agent: 'allow',
      },
      rules: [
        {
          name: 'Escalate security issues',
          when: {
            issue_title: ['security'],
            issue_body: ['credential'],
          },
          effect: 'require_approval',
          reason: 'Security reports need review.',
        },
      ],
    });
    const suite = parsePolicyFixtureSuite({
      version: 1,
      cases: [
        {
          name: 'security issue requires approval',
          input: {
            event: 'issues.opened',
            actor: 'maintainer',
            issue_title: 'Security report',
            issue_body: 'Credential exposure',
          },
          expect: {
            decision: 'require_approval',
            matched_rules: ['Escalate security issues'],
          },
        },
      ],
    });

    expect(runPolicyFixtureSuite(issuePolicy, suite).passed).toBe(true);
  });
});
