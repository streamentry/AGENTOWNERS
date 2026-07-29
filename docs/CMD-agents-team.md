---
name: AGENTOWNERS agent-team workflow
description: Evidence-first coordination for independent contributors and review agents
---

# AGENTOWNERS agent-team workflow

This page describes how multiple contributors or review agents can work on
AGENTOWNERS without weakening its trust boundary. It is repository guidance,
not an instruction to use a particular agent framework or command-line tool.

## Core rule

Parallel work is useful only when ownership and evidence are explicit. Agents
may implement, test, and prepare review material. They do not replace required
human review, approve their own changes, merge pull requests, or publish
releases.

The immutable decision invariant remains:

```text
block > require_approval > allow
```

## Before dispatch

The coordinator must:

1. Refresh `origin/main` and record the base commit.
2. Read `AGENTS.md`, the nearest package guide, the relevant specification,
   `CONTRIBUTING.md`, and the current threat model.
3. Search open and recently merged pull requests and issues for overlap.
4. State the user-visible problem, evidence that it exists, the smallest
   complete change, and the cheapest disconfirming test.
5. Assign each contributor a disjoint file or directory ownership boundary.

Do not dispatch two contributors to the same generated artifact, policy schema,
workflow, or public API without an explicit integration owner. A green test
run is not evidence that overlapping work is safe to merge.

## Safe ownership lanes

| Lane | Typical ownership | Required proof |
| --- | --- | --- |
| Core behavior | `packages/core/src` and focused core tests | Mutation-sensitive test, invariant analysis, `pnpm verify` |
| CLI contract | `packages/cli/src` and CLI tests | Real argument parsing, stdout/stderr, exit-code boundaries, hostile refs |
| Action adapter | `packages/github-action/src` and Action tests | Least-privilege review, mocked API behavior, regenerated bundle |
| Capability boundary | `AGENT_CAPABILITIES.md`, capability modules, fixtures | Identity/scope denial, deterministic hash-chain evidence, simulator-only proof |
| Documentation | `docs`, README, examples, contributor templates | Every command/path/link checked; product claims separated from roadmap claims |
| Release preparation | release scripts and metadata tests only | Packed install, audit, exact-version preflight; workflow changes require a maintainer |
| Read-only review | no repository writes | Findings with mechanism, invariant, reproducer, confidence, and residual risk |

The repository policy currently treats workflow, release-control, Action
metadata, core, dependency, and secret-sensitive changes as privileged. Route
those lanes to the required human reviewers rather than trying to make the
agent's result look like approval.

## Contributor loop

Every implementation lane follows the same loop:

1. Add the smallest failing test or fixture that captures the intended
   behavior.
2. Implement the conventional, fail-closed change.
3. Update the relevant spec, package guide, diagrams, and changelog entry.
4. Regenerate generated artifacts through the repository build; never edit a
   bundle or schema by hand.
5. Run the focused test, then `pnpm verify`.
6. Run `pnpm verify:packages` for package, Action, dependency, or release
   surfaces.
7. Run `pnpm demo` for capability-boundary or onboarding changes.
8. Run the explicit `agentowners self-check` command and record its JSON,
   exit code, and `policyDigest`.
9. Report exact commands, skipped checks, security findings, overlap, and the
   smallest rollback.

## Review loop

A read-only reviewer should examine the complete changed-file set in this
order:

1. State the strongest plausible counterexample.
2. Trace untrusted policy, event text, paths, refs, and patches to every effect.
3. Check `block > require_approval > allow`, fail-closed defaults, secret
   redaction, deterministic output, and shell-free Git argument handling.
4. Verify that tests exercise the changed branch and that generated artifacts
   match source.
5. Report only findings that include severity, exact mechanism, cheapest
   disconfirming test, and confidence.

Reviewer output is preparation for an independent human decision. “No finding”
does not mean “approved.”

## Handoff format

Use this compact handoff in a pull request or issue comment:

```text
Problem:
Invariant changed:
Owned files:
Overlap checked:
Focused proof:
Full proof:
Self-check exit / policyDigest:
Security review:
Known limits:
Rollback:
Human decision required:
```

Preserve distinct counterexamples and contributor attribution when another
change lands first. Close or supersede work only with an exact comparison and
an explanation of what evidence remains valuable.

## Release boundary

No agent should push a semantic release tag, publish npm packages, move the
stable Action tag, or publish to GitHub Marketplace from this workflow. Follow
[`docs/releasing.md`](releasing.md), which records the owner-only prerequisites
and the current workflow integration gate.
