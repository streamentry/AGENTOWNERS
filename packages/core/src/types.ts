// Core type definitions — spec sections 11–12

export type AgentAction =
  | 'open_pr'
  | 'update_pr'
  | 'comment'
  | 'review_comment'
  | 'approve_pr'
  | 'request_changes'
  | 'label_issue'
  | 'close_issue'
  | 'reopen_issue'
  | 'assign_issue'
  | 'edit_workflows'
  | 'modify_tests'
  | 'modify_docs'
  | 'modify_dependencies'
  | 'modify_auth'
  | 'modify_infra'
  | 'touch_secrets'
  | 'change_permissions'
  | 'merge_pr';

export type GitHubEventType =
  | 'pull_request.opened'
  | 'pull_request.synchronize'
  | 'pull_request.reopened'
  | 'pull_request.ready_for_review'
  | 'issue_comment.created'
  | 'issue_comment.edited'
  | 'pull_request_review.submitted'
  | 'issues.labeled'
  | 'issues.closed'
  | 'issues.reopened'
  | 'issues.opened';

export type AgentDetectionConfidence = 'confirmed' | 'likely' | 'possible' | 'unknown';

export type AgentPolicy = {
  match: {
    actors?: string[];
    commitEmails?: string[];
    commitNames?: string[];
    prTitlePatterns?: string[];
    bodyPatterns?: string[];
    labels?: string[];
  };
  allowed?: AgentAction[];
  requires_approval?: AgentAction[];
  blocked?: AgentAction[];
};

export type DefaultPolicy = {
  unknown_agent?: 'allow' | 'require_approval' | 'block';
  known_agent?: 'allow' | 'require_approval' | 'block';
  docs_only?: 'allow' | 'require_approval' | 'block';
  workflows?: 'allow' | 'require_approval' | 'block';
  secrets?: 'allow' | 'require_approval' | 'block';
};

export type AuditConfig = {
  enabled?: boolean;
  output?: string;
};

export type RuleCondition = {
  agents?: string[];
  actors?: string[];
  actions?: AgentAction[];
  files?: string[];
  files_not?: string[];
  labels?: string[];
  pr_title?: string[];
  pr_body?: string[];
  issue_title?: string[];
  issue_body?: string[];
  diff_lines_over?: number;
  commits_over?: number;
  changes_package_files?: boolean;
  changes_workflows?: boolean;
  changes_permissions?: boolean;
  changes_auth?: boolean;
  changes_infra?: boolean;
  docs_only?: boolean;
  tests_only?: boolean;
};

export type Rule = {
  name: string;
  when: RuleCondition;
  effect: 'allow' | 'require_approval' | 'block';
  reviewers?: string[];
  labels?: string[];
  reason: string;
};

export type AgentOwnersPolicy = {
  version: 1;
  agents?: Record<string, AgentPolicy>;
  defaults?: DefaultPolicy;
  rules?: Rule[];
  audit?: AuditConfig;
};

export type MatchedRule = {
  name: string;
  effect: 'allow' | 'require_approval' | 'block';
  reason: string;
  matchedConditions?: string[];
  matchedFiles?: string[];
  reviewers?: string[];
  labels?: string[];
};

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type Decision = {
  effect: 'allow' | 'require_approval' | 'block';
  matchedRules: MatchedRule[];
  matchedAgent?: string;
  detectedActions: AgentAction[];
  riskScore: number;
  riskLevel: RiskLevel;
  requiredReviewers: string[];
  labelsToApply: string[];
  explanation: string;
};

export type AgentDetectionResult = {
  agentName?: string;
  confidence: AgentDetectionConfidence;
  signals: string[];
};

export type PolicyFixtureInput = {
  event: GitHubEventType;
  actor: string;
  changed_files: string[];
  commit_messages: string[];
  labels: string[];
  pr_title?: string;
  pr_body?: string;
  issue_title?: string;
  issue_body?: string;
  review_state?: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
  diff_lines_count?: number;
  commits_count?: number;
};

export type PolicyFixtureExpectation = {
  decision: Decision['effect'];
  matched_rules?: string[];
  matched_agent?: string | null;
  detected_actions?: AgentAction[];
  required_reviewers?: string[];
  labels?: string[];
  risk_level?: RiskLevel;
  risk_score?: number;
};

export type PolicyFixtureCase = {
  name: string;
  input: PolicyFixtureInput;
  expect: PolicyFixtureExpectation;
};

export type PolicyFixtureSuite = {
  version: 1;
  cases: PolicyFixtureCase[];
};

export type PolicyFixtureAssertionFailure = {
  field: keyof PolicyFixtureExpectation;
  expected: unknown;
  actual: unknown;
};

export type PolicyFixtureCaseResult = {
  name: string;
  passed: boolean;
  failures: PolicyFixtureAssertionFailure[];
};

export type PolicyFixtureSuiteResult = {
  passed: boolean;
  total: number;
  passedCount: number;
  failedCount: number;
  cases: PolicyFixtureCaseResult[];
};

export type CapabilityActionType = 'tool' | 'network' | 'secret' | 'data' | 'privilege';

export type CapabilityManifest = {
  version: 1;
  agent: { id: string; issuer: string; identity_sha256: string };
  repositories: string[];
  tools: { allow: string[] };
  network: { allowed_destinations: string[] };
  data: { allowed_secret_scopes: string[]; allowed_data_scopes: string[] };
  privileges: { allow: string[] };
  escalation: { human_approval_required: string[]; kill_on_violation: boolean };
  budgets: {
    max_actions: number;
    max_network_requests: number;
    max_secret_reads: number;
    max_privileged_actions: number;
  };
  audit: { required: true; hash_chain: true };
};

export type CapabilityAttempt = {
  attempt_id: string;
  agent_id: string;
  issuer: string;
  identity_sha256: string;
  type: CapabilityActionType;
  tool?: string;
  destination?: string;
  scope?: string;
  capability?: string;
  repository?: string;
  human_approved?: boolean;
  expected?: 'allow' | 'deny';
};

export type CapabilityDecision = 'allow' | 'deny';

export type CapabilityAuditEvent = {
  sequence: number;
  attempt_id: string;
  agent_id: string;
  issuer: string;
  identity_sha256: string;
  type: CapabilityActionType;
  target: string;
  repository: string | null;
  decision: CapabilityDecision;
  dispatched: boolean;
  reason: string;
  previous_hash: string;
  event_hash: string;
};

export type CapabilityEvaluationResult = {
  schemaVersion: 1;
  status: 'complete';
  summary: {
    attempts: number;
    allowed: number;
    denied: number;
    kill_triggered: boolean;
  };
  audit: CapabilityAuditEvent[];
  auditDigest: string;
};

export type SarifLevel = 'warning' | 'error';

export type SarifLocation = {
  physicalLocation: {
    artifactLocation: {
      uri: string;
    };
  };
};

export type SarifResult = {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations?: SarifLocation[];
  partialFingerprints: { 'agentowners/v1': string };
  properties: {
    decision: Decision['effect'];
    riskScore: number;
    riskLevel: RiskLevel;
    requiredReviewers: string[];
  };
};

export type SarifRule = {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  properties: { tags: ['governance', 'ai-agent'] };
};

export type SarifLog = {
  $schema: 'https://json.schemastore.org/sarif-2.1.0.json';
  version: '2.1.0';
  runs: Array<{
    tool: {
      driver: {
        name: 'AGENTOWNERS';
        informationUri: 'https://github.com/streamentry/AGENTOWNERS';
        rules: SarifRule[];
      };
    };
    results: SarifResult[];
    properties: {
      decision: Decision['effect'];
      riskScore: number;
      riskLevel: RiskLevel;
      detectedActions: AgentAction[];
    };
  }>;
};
