import type { AgentDetectionResult, AgentIdentityTrust, AgentOwnersPolicy } from './types.js';

export type AgentDetectionInput = {
  actor: string;
  commitMessages?: string[];
  commitEmails?: string[];
  commitNames?: string[];
  prTitle?: string;
  prBody?: string;
  issueBody?: string;
  commentBody?: string;
  labels?: string[];
  policy?: AgentOwnersPolicy;
};

export const KNOWN_BOT_ACTORS = [
  'github-copilot[bot]',
  'copilot-swe-agent[bot]',
  'dependabot[bot]',
  'renovate[bot]',
];

export const AGENT_COMMIT_SIGNATURES = [
  'Co-Authored-By: Claude',
  'Co-Authored-By: Codex',
  'Generated with',
  '🤖',
  'AI-generated',
  'Claude Code',
  'OpenAI Codex',
  'Cursor',
];

const AGENT_LABELS = ['ai-generated', 'agent', 'copilot', 'codex', 'claude'];

const PR_BODY_MARKERS = ['🤖 Generated with', '<!-- agentowners'];

const BOT_CO_AUTHOR_PATTERN = /Co-authored-by:.*\[bot\]/i;

export function isKnownBotActor(actor: string): boolean {
  return KNOWN_BOT_ACTORS.includes(actor);
}

export function matchesAgentPolicy(actor: string, policy: AgentOwnersPolicy): string | null {
  return findPolicyAgent({ actor }, policy)?.name ?? null;
}

type PolicyAgentMatch = {
  name: string;
  signal: string;
  identityTrust: AgentIdentityTrust;
};

type PolicyMatchMode = 'actor' | 'metadata' | 'any';

function findPolicyAgent(
  input: AgentDetectionInput,
  policy: AgentOwnersPolicy,
  mode: PolicyMatchMode = 'any',
): PolicyAgentMatch | null {
  if (!policy.agents) return null;
  for (const [name, agentPolicy] of Object.entries(policy.agents)) {
    const match = agentPolicy.match;
    if (mode !== 'metadata' && match.actors?.includes(input.actor)) {
      return { name, signal: 'actors', identityTrust: 'verified' };
    }
    if (
      mode !== 'actor' &&
      match.commitEmails?.some((email) => input.commitEmails?.includes(email))
    ) {
      return { name, signal: 'commitEmails', identityTrust: 'unverified' };
    }
    if (
      mode !== 'actor' &&
      match.commitNames?.some((commitName) => input.commitNames?.includes(commitName))
    ) {
      return { name, signal: 'commitNames', identityTrust: 'unverified' };
    }
    if (mode !== 'actor' && match.labels?.some((label) => input.labels?.includes(label))) {
      return { name, signal: 'labels', identityTrust: 'unverified' };
    }
  }
  return null;
}

function matchesConfiguredPattern(value: string | undefined, pattern: string): boolean {
  if (!value) return false;
  try {
    return new RegExp(pattern, 'i').test(value);
  } catch {
    return false;
  }
}

export function detectAgent(input: AgentDetectionInput): AgentDetectionResult {
  const {
    actor,
    commitMessages = [],
    commitEmails = [],
    commitNames = [],
    prTitle,
    prBody,
    issueBody,
    commentBody,
    labels = [],
    policy,
  } = input;
  const signals: string[] = [];
  const bodyTexts = [prBody, issueBody, commentBody].filter(
    (value): value is string => value !== undefined,
  );

  // 1. Policy match. Exact metadata matches are confirmed detection but do
  // not authenticate the actor; identityTrust keeps that boundary explicit.
  if (policy) {
    // Authenticated actor mappings outrank all metadata mappings, regardless
    // of YAML object order. This prevents a forged email or label from
    // shadowing a verified actor identity.
    const actorPolicyMatch = findPolicyAgent({ actor }, policy, 'actor');
    if (actorPolicyMatch) {
      signals.push(
        `policy match: agents.${actorPolicyMatch.name}.match.${actorPolicyMatch.signal}`,
      );
      return {
        agentName: actorPolicyMatch.name,
        confidence: 'confirmed',
        signals,
        identityTrust: actorPolicyMatch.identityTrust,
      };
    }
  }

  // 2. Known bot actor (confirmed and verified). Weak metadata and body
  // patterns must not shadow an authenticated GitHub actor.
  if (isKnownBotActor(actor)) {
    signals.push(`known bot actor: ${actor}`);
    return { confidence: 'confirmed', signals, identityTrust: 'verified' };
  }

  if (policy) {
    const metadataPolicyMatch = findPolicyAgent(
      { actor, commitEmails, commitNames, labels },
      policy,
      'metadata',
    );
    if (metadataPolicyMatch) {
      signals.push(
        `policy match: agents.${metadataPolicyMatch.name}.match.${metadataPolicyMatch.signal}`,
      );
      return {
        agentName: metadataPolicyMatch.name,
        confidence: 'confirmed',
        signals,
        identityTrust: metadataPolicyMatch.identityTrust,
      };
    }

    // Configured body patterns (from policy) are unverified metadata.
    if (policy.agents) {
      for (const [name, agentPolicy] of Object.entries(policy.agents)) {
        const bodyPatterns = agentPolicy.match?.bodyPatterns ?? [];
        const titlePatterns = agentPolicy.match?.prTitlePatterns ?? [];
        for (const pattern of bodyPatterns) {
          if (bodyTexts.some((body) => matchesConfiguredPattern(body, pattern))) {
            signals.push(`policy body pattern match: agents.${name}`);
            return {
              agentName: name,
              confidence: 'confirmed',
              signals,
              identityTrust: 'unverified',
            };
          }
        }
        for (const pattern of titlePatterns) {
          if (matchesConfiguredPattern(prTitle, pattern)) {
            signals.push(`policy title pattern match: agents.${name}`);
            return {
              agentName: name,
              confidence: 'confirmed',
              signals,
              identityTrust: 'unverified',
            };
          }
        }
      }
    }
  }

  // 3. Commit message signatures (likely)
  const allText = [...commitMessages, ...bodyTexts].join('\n');
  for (const sig of AGENT_COMMIT_SIGNATURES) {
    if (allText.includes(sig)) {
      signals.push(`commit/body signature: "${sig}"`);
    }
  }

  // 4. PR or comment body markers (likely)
  for (const marker of PR_BODY_MARKERS) {
    if (bodyTexts.some((body) => body.includes(marker))) {
      signals.push(`body marker: "${marker}"`);
    }
  }
  if (bodyTexts.some((body) => BOT_CO_AUTHOR_PATTERN.test(body))) {
    signals.push('body co-author [bot] pattern');
  }

  if (signals.length > 0) {
    return { confidence: 'likely', signals, identityTrust: 'unverified' };
  }

  // 5. Labels (possible)
  const matchedLabels = labels.filter((l) => AGENT_LABELS.includes(l));
  if (matchedLabels.length > 0) {
    for (const label of matchedLabels) {
      signals.push(`label: "${label}"`);
    }
    return { confidence: 'possible', signals, identityTrust: 'unverified' };
  }

  // Fallthrough
  return { confidence: 'unknown', signals, identityTrust: 'unverified' };
}
