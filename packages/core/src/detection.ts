import type { AgentDetectionConfidence, AgentDetectionResult, AgentOwnersPolicy } from './types.js';

export type AgentDetectionInput = {
  actor: string;
  commitMessages?: string[];
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

const PR_BODY_MARKERS = [
  '🤖 Generated with',
  '<!-- agentowners',
];

function hasBotCoAuthor(value: string): boolean {
  return value.split('\n').some((line) => {
    const normalized = line.toLowerCase();
    const coAuthorIndex = normalized.indexOf('co-authored-by:');
    return coAuthorIndex >= 0 && normalized.indexOf('[bot]', coAuthorIndex) >= 0;
  });
}

export function isKnownBotActor(actor: string): boolean {
  return KNOWN_BOT_ACTORS.includes(actor);
}

export function matchesAgentPolicy(
  actor: string,
  policy: AgentOwnersPolicy,
): string | null {
  if (!policy.agents) return null;
  for (const [name, agentPolicy] of Object.entries(policy.agents)) {
    if (agentPolicy.match?.actors?.includes(actor)) {
      return name;
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

  // 1. Policy match (confirmed)
  if (policy) {
    const matchedAgent = matchesAgentPolicy(actor, policy);
    if (matchedAgent) {
      signals.push(`policy match: agents.${matchedAgent}.match.actors`);
      return { agentName: matchedAgent, confidence: 'confirmed', signals };
    }

    // 6. Configured body patterns (from policy) — checked alongside policy
    if (policy.agents) {
      for (const [name, agentPolicy] of Object.entries(policy.agents)) {
        const bodyPatterns = agentPolicy.match?.bodyPatterns ?? [];
        const titlePatterns = agentPolicy.match?.prTitlePatterns ?? [];
        for (const pattern of bodyPatterns) {
          if (bodyTexts.some((body) => matchesConfiguredPattern(body, pattern))) {
            signals.push(`policy body pattern match: agents.${name}`);
            return { agentName: name, confidence: 'confirmed', signals };
          }
        }
        for (const pattern of titlePatterns) {
          if (matchesConfiguredPattern(prTitle, pattern)) {
            signals.push(`policy title pattern match: agents.${name}`);
            return { agentName: name, confidence: 'confirmed', signals };
          }
        }
      }
    }
  }

  // 2. Known bot actor (confirmed)
  if (isKnownBotActor(actor)) {
    signals.push(`known bot actor: ${actor}`);
    return { confidence: 'confirmed', signals };
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
  if (bodyTexts.some(hasBotCoAuthor)) {
    signals.push('body co-author [bot] pattern');
  }

  if (signals.length > 0) {
    return { confidence: 'likely', signals };
  }

  // 5. Labels (possible)
  const matchedLabels = labels.filter((l) => AGENT_LABELS.includes(l));
  if (matchedLabels.length > 0) {
    for (const label of matchedLabels) {
      signals.push(`label: "${label}"`);
    }
    return { confidence: 'possible', signals };
  }

  // Fallthrough
  return { confidence: 'unknown', signals };
}
