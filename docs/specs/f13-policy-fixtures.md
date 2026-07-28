# F13: Portable Policy Fixtures

## Objective

Let repositories encode policy expectations as a strict, versioned YAML suite
and execute them without GitHub, Git, a model, or network access.

## Command

```text
agentowners test \
  --policy .github/AGENTOWNERS.yml \
  --fixtures .agentowners/fixtures.yml
```

Both paths are mandatory. Output defaults to `text`; `--output json` emits the
versioned machine contract.

## Fixture Contract

```yaml
version: 1

cases:
  - name: workflow changes are blocked
    input:
      event: pull_request.opened
      actor: github-copilot[bot]
      changed_files:
        - .github/workflows/release.yml
      commit_messages: []
      labels: []
    expect:
      decision: block
      matched_rules:
        - Block workflow changes
      detected_actions:
        - edit_workflows
        - open_pr
      required_reviewers:
        - '@security'
      labels:
        - ai-agent
        - risk-critical
        - security-review
      risk_level: critical
      risk_score: 100
```

### Input

Required:

- `event`
- `actor`

Optional:

- `changed_files`, default `[]`
- `commit_messages`, default `[]`
- `commit_emails`, default `[]`
- `commit_names`, default `[]`
- `labels`, default `[]`
- `pr_title`
- `pr_body`
- `issue_title`
- `issue_body`
- `review_state`
- `diff_content`
- `diff_lines_count`
- `commits_count`

`review_state` is valid only for `pull_request_review.submitted`.
`changed_files` is valid only for pull-request and pull-request-review events.
Non-empty `commit_messages`, `commit_emails`, `commit_names`,
`diff_content`, `diff_lines_count`, and `commits_count` are valid
only for pull-request and pull-request-review events. `pr_title` and `pr_body`
are valid for pull-request, pull-request-review, and issue-comment events
because an issue comment can target a pull request. `issue_title` and
`issue_body` are valid for issue and issue-comment events. An issue-comment
fixture cannot provide both pull-request and issue metadata because one comment
has only one target.
Paths must be repository-relative Git paths with `/` separators. Absolute
paths, drive prefixes, backslashes, empty segments, `.` segments, `..`
segments, and NUL bytes are invalid.

### Expectations

`decision` is mandatory. The remaining fields are optional exact assertions:

- `matched_rules`
- `matched_agent`
- `detected_actions`
- `required_reviewers`
- `labels`
- `risk_level`
- `risk_score`

Rule, action, reviewer, and label arrays are semantic sets. Their YAML order
does not affect the result, but duplicate values are invalid.

## Evaluation Path

Every case uses the same public production functions:

1. validate the suite;
2. classify changed files and scan supplied diff content for secret patterns;
3. detect the agent;
4. infer actions from the event and diff content;
5. evaluate policy;
6. compare requested expectations;
7. emit all assertion failures in stable field order.

Fixtures cannot inject inferred actions or precomputed classification. This
prevents a suite from bypassing the behavior it claims to test.
`diff_content` is passed through the same redacted secret-pattern detector used
by the GitHub Action. Fixture results expose only the inferred `touch_secrets`
action and decision; they never expose matched secret values.

## Exit Codes

| Code | Meaning                                    |
| ---: | ------------------------------------------ |
|  `0` | Every fixture passed                       |
|  `1` | One or more assertions failed              |
| `64` | Missing input or unsupported output format |
| `65` | Policy read or validation failure          |
| `66` | Fixture read or validation failure         |
| `70` | Unexpected internal failure                |

Invalid policy and fixture diagnostics do not echo untrusted file contents.

## Invariants

- Same policy and suite produce byte-stable JSON results.
- The runner performs no network, shell, clock, random, credential, or
  persistent-state operation.
- Unknown fields and duplicate case names fail validation.
- A suite cannot pass without asserting a decision for every case.
- Assertion failures never alter policy evaluation or subsequent cases.
