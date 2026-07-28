import type {
  Decision,
  MatchedRule,
  SarifLevel,
  SarifLocation,
  SarifLog,
  SarifResult,
  SarifRule,
} from './types.js';

const DEFAULT_RULE_ID = 'AGENTOWNERS/DEFAULT';

type RuleEntry = {
  id: string;
  rule: MatchedRule;
};

function stableHash(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function ruleId(rule: MatchedRule): string {
  return `AGENTOWNERS/${stableHash(`${rule.name}\0${rule.effect}\0${rule.reason}`)}`;
}

function artifactUri(file: string): string | undefined {
  if (
    !file ||
    file.includes('\0') ||
    file.includes('\\') ||
    file.startsWith('/') ||
    /^[A-Za-z]:\//.test(file)
  ) {
    return undefined;
  }
  const segments = file.split('/');
  if (segments.some((segment) => segment === '..' || segment === '.' || segment === '')) {
    return undefined;
  }
  try {
    return segments.map(encodeURIComponent).join('/');
  } catch {
    return undefined;
  }
}

function location(uri: string): SarifLocation {
  return {
    physicalLocation: {
      artifactLocation: { uri },
    },
  };
}

function descriptor(entry: RuleEntry): SarifRule {
  return {
    id: entry.id,
    name: entry.rule.name,
    shortDescription: { text: entry.rule.name },
    fullDescription: { text: entry.rule.reason },
    properties: { tags: ['governance', 'ai-agent'] },
  };
}

function result(
  decision: Decision,
  rule: MatchedRule,
  id: string,
  level: SarifLevel,
  uri?: string,
): SarifResult {
  return {
    ruleId: id,
    level,
    message: { text: rule.reason },
    ...(uri ? { locations: [location(uri)] } : {}),
    partialFingerprints: { 'agentowners/v1': stableHash(`${id}\0${uri ?? ''}`) },
    properties: {
      decision: decision.effect,
      riskScore: decision.riskScore,
      riskLevel: decision.riskLevel,
      requiredReviewers: [...decision.requiredReviewers].sort(),
    },
  };
}

function ruleResults(decision: Decision, entry: RuleEntry, level: SarifLevel): SarifResult[] {
  const { id, rule } = entry;
  const uris = [...new Set((rule.matchedFiles ?? []).map(artifactUri).filter(Boolean))].sort();
  return uris.length > 0
    ? uris.map((uri) => result(decision, rule, id, level, uri))
    : [result(decision, rule, id, level)];
}

function syntheticRule(decision: Decision): MatchedRule {
  const reason =
    decision.effect === 'block'
      ? 'Repository policy blocks this agent action.'
      : 'Repository policy requires human approval.';
  return {
    name: 'Default policy decision',
    effect: decision.effect,
    reason,
  };
}

function actionableEntries(decision: Decision): RuleEntry[] {
  const rules = decision.matchedRules.filter((rule) => rule.effect !== 'allow');
  const entries = rules.map((rule) => ({ id: ruleId(rule), rule }));
  if (!rules.some((rule) => rule.effect === decision.effect)) {
    entries.push({ id: DEFAULT_RULE_ID, rule: syntheticRule(decision) });
  }
  return entries.sort((left, right) => {
    const idOrder = compareText(left.id, right.id);
    if (idOrder !== 0) return idOrder;
    return compareText(left.rule.reason, right.rule.reason);
  });
}

export function renderSarif(decision: Decision): SarifLog {
  const entries = decision.effect === 'allow' ? [] : actionableEntries(decision);
  const descriptors = [...new Map(entries.map((entry) => [entry.id, descriptor(entry)])).values()];
  const results = entries
    .flatMap((entry) =>
      ruleResults(decision, entry, entry.rule.effect === 'block' ? 'error' : 'warning'),
    )
    .sort((left, right) => {
      const idOrder = compareText(left.ruleId, right.ruleId);
      if (idOrder !== 0) return idOrder;
      const leftUri = left.locations?.[0].physicalLocation.artifactLocation.uri ?? '';
      const rightUri = right.locations?.[0].physicalLocation.artifactLocation.uri ?? '';
      return compareText(leftUri, rightUri);
    });

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'AGENTOWNERS',
            informationUri: 'https://github.com/streamentry/AGENTOWNERS',
            rules: descriptors,
          },
        },
        results,
        properties: {
          decision: decision.effect,
          riskScore: decision.riskScore,
          riskLevel: decision.riskLevel,
          detectedActions: [...decision.detectedActions].sort(),
        },
      },
    ],
  };
}
