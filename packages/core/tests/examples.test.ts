import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  classifyFiles,
  detectAgent,
  evaluatePolicy,
  inferActions,
  loadPolicyFixtureFile,
  parsePolicy,
  runPolicyFixtureSuite,
  type AgentOwnersPolicy,
} from '../src/index.js';

const examplesRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../examples');

function exampleDirectories(): string[] {
  return readdirSync(examplesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function loadExample(name: string): AgentOwnersPolicy {
  const contents = readFileSync(join(examplesRoot, name, 'AGENTOWNERS.yml'), 'utf8');
  return parsePolicy(yaml.load(contents));
}

function evaluateExample(policy: AgentOwnersPolicy, actor: string, changedFiles: string[]) {
  const filesClassification = classifyFiles(changedFiles);
  const agentDetection = detectAgent({ actor, policy });
  const detectedActions = inferActions({
    eventType: 'pull_request.opened',
    changedFiles,
    filesClassification,
  });
  return evaluatePolicy({
    policy,
    agentDetection,
    detectedActions,
    changedFiles,
    filesClassification,
    actor,
  });
}

describe('checked-in examples', () => {
  const directories = exampleDirectories();

  it('discovers example directories in deterministic order', () => {
    expect(directories).toEqual([...directories].sort());
    expect(directories).toContain('dependency-bots');
  });

  it.each(directories)('%s contains exactly one canonical policy file', (directory) => {
    const policies = readdirSync(join(examplesRoot, directory)).filter(
      (entry) => entry === 'AGENTOWNERS.yml',
    );
    expect(policies).toEqual(['AGENTOWNERS.yml']);
  });

  it.each(directories)('%s parses through the public policy API', (directory) => {
    expect(() => loadExample(directory)).not.toThrow();
  });

  it.each(directories)('%s proves its documented behavior with portable fixtures', async (directory) => {
    const policy = loadExample(directory);
    const suite = await loadPolicyFixtureFile(
      join(examplesRoot, directory, 'AGENTOWNERS.fixtures.yml'),
    );
    const result = runPolicyFixtureSuite(policy, suite);

    expect(result).toMatchObject({
      passed: true,
      failedCount: 0,
    });
  });
});

describe('dependency-bots example behavior', () => {
  const dependencyCases = [
    { actor: 'dependabot[bot]', files: ['package.json'], effect: 'require_approval' },
    { actor: 'renovate[bot]', files: ['pnpm-lock.yaml'], effect: 'require_approval' },
  ] as const;
  const restrictedCases = ['dependabot[bot]', 'renovate[bot]'].flatMap((actor) =>
    [
      '.github/workflows/update.yml',
      'src/permissions/roles.ts',
      '.env.production',
    ].map((file) => ({ actor, files: [file], effect: 'block' as const })),
  );

  it.each([...dependencyCases, ...restrictedCases])(
    '$actor changing $files resolves to $effect',
    ({ actor, files, effect }) => {
      const policy = loadExample('dependency-bots');
      const decision = evaluateExample(policy, actor, [...files]);

      expect(decision.effect).toBe(effect);
    },
  );

  it.each([
    ['dependabot[bot]', 'dependabot'],
    ['renovate[bot]', 'renovate'],
  ] as const)('matches %s exactly as %s', (actor, expectedAgent) => {
    const policy = loadExample('dependency-bots');

    expect(detectAgent({ actor, policy })).toMatchObject({
      agentName: expectedAgent,
      confidence: 'confirmed',
    });
    expect(detectAgent({ actor: actor.toUpperCase(), policy }).agentName).toBeUndefined();
  });

  it.each(['dependabot', 'renovate'])(
    '%s explicitly governs dependency and privileged actions',
    (agentName) => {
      const agent = loadExample('dependency-bots').agents?.[agentName];

      expect(agent?.requires_approval).toContain('modify_dependencies');
      expect(agent?.blocked).toEqual(
        expect.arrayContaining([
          'edit_workflows',
          'modify_auth',
          'change_permissions',
          'touch_secrets',
        ]),
      );
    },
  );
});
