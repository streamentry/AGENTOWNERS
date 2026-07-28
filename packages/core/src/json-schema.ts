import { zodToJsonSchema } from 'zod-to-json-schema';
import { agentActionSchema, agentOwnersPolicySchema } from './schema.js';

export type AgentOwnersJsonSchema = Record<string, unknown>;

const ACTION_LISTS = ['allowed', 'requires_approval', 'blocked'] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(`Generated JSON Schema is missing object at ${path}`);
  }
  return value;
}

function child(
  parent: Record<string, unknown>,
  key: string,
  path: string,
): Record<string, unknown> {
  return requireObject(parent[key], `${path}.${key}`);
}

function actionConflictConstraints(): AgentOwnersJsonSchema[] {
  const constraints: AgentOwnersJsonSchema[] = [];

  for (let leftIndex = 0; leftIndex < ACTION_LISTS.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < ACTION_LISTS.length; rightIndex += 1) {
      const left = ACTION_LISTS[leftIndex];
      const right = ACTION_LISTS[rightIndex];

      for (const action of agentActionSchema.options) {
        constraints.push({
          not: {
            required: [left, right],
            properties: {
              [left]: { type: 'array', contains: { const: action } },
              [right]: { type: 'array', contains: { const: action } },
            },
          },
        });
      }
    }
  }

  return constraints;
}

function restoreZodRefinements(schema: AgentOwnersJsonSchema): void {
  const definitions = child(schema, 'definitions', 'schema');
  const policy = child(definitions, 'AgentOwnersPolicy', 'schema.definitions');
  const policyProperties = child(policy, 'properties', 'schema.definitions.AgentOwnersPolicy');
  const agents = child(policyProperties, 'agents', 'policy.properties');
  const agentPolicy = child(agents, 'additionalProperties', 'policy.properties.agents');
  const agentProperties = child(agentPolicy, 'properties', 'agentPolicy');
  const match = child(agentProperties, 'match', 'agentPolicy.properties');
  const rules = child(policyProperties, 'rules', 'policy.properties');
  const rule = child(rules, 'items', 'policy.properties.rules');
  const ruleProperties = child(rule, 'properties', 'rule');
  const when = child(ruleProperties, 'when', 'rule.properties');

  match.minProperties = 1;
  when.minProperties = 1;
  agentPolicy.allOf = actionConflictConstraints();
}

export function generateAgentOwnersJsonSchema(): AgentOwnersJsonSchema {
  const generated = zodToJsonSchema(agentOwnersPolicySchema, {
    name: 'AgentOwnersPolicy',
    target: 'jsonSchema7',
  }) as AgentOwnersJsonSchema;

  restoreZodRefinements(generated);

  return {
    $schema: generated.$schema,
    $id: 'https://raw.githubusercontent.com/streamentry/AGENTOWNERS/main/packages/core/agentowners.schema.json',
    title: 'AGENTOWNERS policy',
    description: 'Deterministic governance policy for AI-agent contributions.',
    $ref: generated.$ref,
    definitions: generated.definitions,
  };
}
