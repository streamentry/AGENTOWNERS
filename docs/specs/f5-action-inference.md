# F5: Action Inference

## Objective
Infer what AgentActions are being performed based on GitHub event context and changed files.

## Package
`packages/core/src/actions.ts`

## Event-to-Action Mapping (spec section 13)

### pull_request opened
- Always: `open_pr`
- If docs only: `modify_docs`
- If test files changed: `modify_tests`
- If dependency files changed: `modify_dependencies`
- If `.github/workflows/**` changed: `edit_workflows`
- If auth paths changed: `modify_auth`
- If infra paths changed: `modify_infra`
- If secrets detected: `touch_secrets`

### pull_request synchronize/update
- Always: `update_pr`
- Then infer file-based actions same as opened

### issue_comment created/edited
- Always: `comment`

### pull_request_review submitted
- Always: `review_comment`
- If state is APPROVED: `approve_pr`
- If state is CHANGES_REQUESTED: `request_changes`

### issues labeled
- Always: `label_issue`

### issues closed
- Always: `close_issue`

### issues reopened
- Always: `reopen_issue`

### issues opened
- Always: `open_issue`

## Types

```ts
export type GitHubEventType =
  | "pull_request.opened"
  | "pull_request.synchronize"
  | "pull_request.reopened"
  | "pull_request.ready_for_review"
  | "issue_comment.created"
  | "issue_comment.edited"
  | "pull_request_review.submitted"
  | "issues.labeled"
  | "issues.closed"
  | "issues.reopened"
  | "issues.opened";

export type ActionInferenceInput = {
  eventType: GitHubEventType;
  changedFiles?: string[];
  diffContent?: string;
  reviewState?: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED";
  filesClassification?: FilesClassification;
};
```

## Functions

### `inferActions(input: ActionInferenceInput): AgentAction[]`
Return deduplicated list of inferred actions. Never return duplicates.
When `filesClassification` is omitted, derive it with the canonical
`classifyFiles()` implementation rather than maintaining a second pattern set.
When a caller supplies an aggregate classification, normalize both the local
field names and the canonical `FilesClassification` field names.

### `inferFileBasedActions(classification: FilesClassification): AgentAction[]`
Infer actions from file classification only.
When aggregate classification includes per-file records, infer
`modify_tests` from at least one `isTests` record. `testsOnly: false` does not
mean that tests changed.

## Tests (`packages/core/tests/actions.test.ts`)
- PR opened with docs files → `[open_pr, modify_docs]`
- Nested AsciiDoc files use the canonical classifier and infer `modify_docs`
- PR opened with workflow files → `[open_pr, edit_workflows]`
- PR opened with auth files → `[open_pr, modify_auth]`
- PR opened with package.json → `[open_pr, modify_dependencies]`
- PR opened with test files → `[open_pr, modify_tests]`
- Source-only classification does not infer `modify_tests`
- Mixed source and test classification infers `modify_tests`
- Issue comment → `[comment]`
- Review approved → `[review_comment, approve_pr]`
- Review changes_requested → `[review_comment, request_changes]`
- Issue labeled → `[label_issue]`
- Issue opened → `[open_issue]`
- No duplicates in output
