import { z } from 'zod';
import type { AgentOwnersPolicy } from './types.js';

export const agentActionSchema = z.enum([
  'open_pr',
  'update_pr',
  'comment',
  'review_comment',
  'approve_pr',
  'request_changes',
  'label_issue',
  'close_issue',
  'reopen_issue',
  'assign_issue',
  'edit_workflows',
  'modify_tests',
  'modify_docs',
  'modify_dependencies',
  'modify_auth',
  'modify_infra',
  'touch_secrets',
  'change_permissions',
  'merge_pr',
]);

export const agentDetectionConfidenceSchema = z.enum([
  'confirmed',
  'likely',
  'possible',
  'unknown',
]);

const agentMatchSchema = z
  .object({
    actors: z.array(z.string()).optional(),
    commitEmails: z.array(z.string()).optional(),
    commitNames: z.array(z.string()).optional(),
    prTitlePatterns: z.array(z.string()).optional(),
    bodyPatterns: z.array(z.string()).optional(),
    labels: z.array(z.string()).optional(),
  })
  .strict()
  .refine((match) => Object.keys(match).length > 0, {
    message: 'Agent match must define at least one signal',
  });

const agentPolicySchema = z
  .object({
    match: agentMatchSchema,
    allowed: z.array(agentActionSchema).optional(),
    requires_approval: z.array(agentActionSchema).optional(),
    blocked: z.array(agentActionSchema).optional(),
  })
  .strict()
  .superRefine((policy, context) => {
    const assignments = [
      ['allowed', policy.allowed ?? []],
      ['requires_approval', policy.requires_approval ?? []],
      ['blocked', policy.blocked ?? []],
    ] as const;
    const owners = new Map<string, string>();

    for (const [list, actions] of assignments) {
      for (const action of actions) {
        const existing = owners.get(action);
        if (existing) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [list],
            message: `"${action}" is already assigned to ${existing}`,
          });
        } else {
          owners.set(action, list);
        }
      }
    }
  });

export const defaultPolicySchema = z
  .object({
    unknown_agent: z.enum(['allow', 'require_approval', 'block']).optional(),
    known_agent: z.enum(['allow', 'require_approval', 'block']).optional(),
    docs_only: z.enum(['allow', 'require_approval', 'block']).optional(),
    workflows: z.enum(['allow', 'require_approval', 'block']).optional(),
    secrets: z.enum(['allow', 'require_approval', 'block']).optional(),
  })
  .strict();

const auditConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    output: z.string().optional(),
  })
  .strict();

export const ruleConditionSchema = z
  .object({
    agents: z.array(z.string()).optional(),
    actors: z.array(z.string()).optional(),
    actions: z.array(agentActionSchema).optional(),
    files: z.array(z.string()).optional(),
    files_not: z.array(z.string()).optional(),
    labels: z.array(z.string()).optional(),
    pr_title: z.array(z.string()).optional(),
    pr_body: z.array(z.string()).optional(),
    issue_title: z.array(z.string()).optional(),
    issue_body: z.array(z.string()).optional(),
    diff_lines_over: z.number().optional(),
    commits_over: z.number().optional(),
    changes_package_files: z.boolean().optional(),
    changes_workflows: z.boolean().optional(),
    changes_permissions: z.boolean().optional(),
    changes_auth: z.boolean().optional(),
    changes_infra: z.boolean().optional(),
    docs_only: z.boolean().optional(),
    tests_only: z.boolean().optional(),
  })
  .strict()
  .refine((condition) => Object.keys(condition).length > 0, {
    message: 'Rule must define at least one condition',
  });

export const ruleSchema = z
  .object({
    name: z.string(),
    when: ruleConditionSchema,
    effect: z.enum(['allow', 'require_approval', 'block']),
    reviewers: z.array(z.string()).optional(),
    labels: z.array(z.string()).optional(),
    reason: z.string(),
  })
  .strict();

export { agentPolicySchema };

export const agentOwnersPolicySchema = z
  .object({
    version: z.literal(1),
    agents: z.record(z.string(), agentPolicySchema).optional(),
    defaults: defaultPolicySchema.optional(),
    rules: z.array(ruleSchema).optional(),
    audit: auditConfigSchema.optional(),
  })
  .strict();

// Keep legacy export for backward compatibility
export const AgentOwnersPolicySchema = agentOwnersPolicySchema;

export function parsePolicy(input: unknown): AgentOwnersPolicy {
  return agentOwnersPolicySchema.parse(input) as AgentOwnersPolicy;
}
