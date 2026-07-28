import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { generateAgentOwnersJsonSchema } from '../src/json-schema';
import { agentOwnersPolicySchema } from '../src/schema';

const validPolicy = {
  version: 1,
  agents: {
    copilot: {
      match: {
        actors: ['github-copilot[bot]'],
      },
      allowed: ['modify_docs'],
      requires_approval: ['modify_tests'],
      blocked: ['edit_workflows'],
    },
  },
  rules: [
    {
      name: 'Protect workflows',
      when: {
        changes_workflows: true,
      },
      effect: 'block',
      reason: 'Workflow changes require a human.',
    },
  ],
} as const;

function compileGeneratedSchema() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  return ajv.compile(generateAgentOwnersJsonSchema());
}

describe('generateAgentOwnersJsonSchema', () => {
  it('is byte-for-byte deterministic', () => {
    const first = JSON.stringify(generateAgentOwnersJsonSchema(), null, 2);
    const second = JSON.stringify(generateAgentOwnersJsonSchema(), null, 2);

    expect(second).toBe(first);
  });

  it('matches the checked-in generated artifact', async () => {
    const checkedIn = await readFile(
      new URL('../agentowners.schema.json', import.meta.url),
      'utf8',
    );
    const generated = `${JSON.stringify(generateAgentOwnersJsonSchema(), null, 2)}\n`;

    expect(checkedIn).toBe(generated);
  });

  it('accepts a complete valid policy in JSON Schema and Zod', () => {
    const validate = compileGeneratedSchema();

    expect(validate(validPolicy)).toBe(true);
    expect(agentOwnersPolicySchema.safeParse(validPolicy).success).toBe(true);
  });

  it('rejects misspelled conditions in JSON Schema and Zod', () => {
    const policy = {
      version: 1,
      rules: [
        {
          name: 'Misspelled condition',
          when: {
            change_workflows: true,
          },
          effect: 'block',
          reason: 'This field must not be ignored.',
        },
      ],
    };
    const validate = compileGeneratedSchema();

    expect(validate(policy)).toBe(false);
    expect(agentOwnersPolicySchema.safeParse(policy).success).toBe(false);
  });

  it('rejects empty match and when objects in JSON Schema and Zod', () => {
    const policies = [
      {
        version: 1,
        agents: {
          empty: {
            match: {},
          },
        },
      },
      {
        version: 1,
        rules: [
          {
            name: 'Empty condition',
            when: {},
            effect: 'block',
            reason: 'No condition must never match.',
          },
        ],
      },
    ];
    const validate = compileGeneratedSchema();

    for (const policy of policies) {
      expect(validate(policy)).toBe(false);
      expect(agentOwnersPolicySchema.safeParse(policy).success).toBe(false);
    }
  });

  it('rejects an action assigned to multiple agent lists in JSON Schema and Zod', () => {
    const policy = {
      version: 1,
      agents: {
        conflicted: {
          match: {
            actors: ['agent[bot]'],
          },
          allowed: ['modify_docs'],
          blocked: ['modify_docs'],
        },
      },
    };
    const validate = compileGeneratedSchema();

    expect(validate(policy)).toBe(false);
    expect(agentOwnersPolicySchema.safeParse(policy).success).toBe(false);
  });
});
