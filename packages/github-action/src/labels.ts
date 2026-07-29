import type { Octokit } from './github.js';

export const RESERVED_RISK_LABELS = [
  'risk-low',
  'risk-medium',
  'risk-high',
  'risk-critical',
] as const;

const LABEL_COLORS: Record<string, string> = {
  'ai-agent': 'a2eeef',
  'risk-low': '0e8a16',
  'risk-medium': 'fbca04',
  'risk-high': 'e4e669',
  'risk-critical': 'd73a4a',
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function labelsToAdd(existingLabels: string[], desiredLabels: string[]): string[] {
  const existing = new Set(existingLabels.map((label) => label.toLowerCase()));
  return unique(desiredLabels).filter((label) => !existing.has(label.toLowerCase()));
}

export function riskLabelsToRemove(
  existingLabels: string[],
  desiredLabels: string[],
): string[] {
  const desiredRiskLabels = new Set<string>(
    desiredLabels.filter((label) =>
      RESERVED_RISK_LABELS.includes(label as (typeof RESERVED_RISK_LABELS)[number]),
    ),
  );
  return unique(
    existingLabels.filter(
      (label) =>
        RESERVED_RISK_LABELS.includes(label as (typeof RESERVED_RISK_LABELS)[number]) &&
        !desiredRiskLabels.has(label),
    ),
  );
}

async function ensureLabelsExist(octokit: Octokit, owner: string, repo: string, labels: string[]) {
  for (const label of labels) {
    try {
      await octokit.rest.issues.getLabel({ owner, repo, name: label });
    } catch {
      const color = LABEL_COLORS[label] ?? 'ededed';
      try {
        await octokit.rest.issues.createLabel({ owner, repo, name: label, color });
      } catch {
        // A concurrent run may create the label first; addLabels is authoritative.
      }
    }
  }
}

export async function applyLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  existingLabels: string[],
  desiredLabels: string[],
): Promise<void> {
  const additions = labelsToAdd(existingLabels, desiredLabels);
  const removals = riskLabelsToRemove(existingLabels, desiredLabels);

  if (additions.length > 0) {
    await ensureLabelsExist(octokit, owner, repo, additions);
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: additions,
    });
  }

  for (const label of removals) {
    await octokit.rest.issues.removeLabel({
      owner,
      repo,
      issue_number: issueNumber,
      name: label,
    });
  }
}
