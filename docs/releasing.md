# Release runbook

This runbook defines the evidence required for a public AGENTOWNERS release.
It is a maintainer procedure, not permission for an agent to publish packages,
create a tag, or merge a pull request.

## Release gate

Do not create a release tag until every item is true:

- The exact release commit is on `main` and has at least one independent
  maintainer approval. A green check, an AI-assisted review, or the release
  environment's owner gate is not independent approval.
- The pull request required checks are green: `test`, both CodeQL analyses, and
  `CodeQL`. Required review protection remains enabled.
- The release workflow's third-party actions are pinned to reviewed full commit
  SHAs. A mutable tag is a supply-chain risk for a job with package-publish and
  release-write permissions.
- `pnpm verify` and `pnpm verify:packages` pass from a clean worktree.
- `pnpm verify:release` confirms package versions, exports, the CLI entrypoint,
  the Action metadata, and the committed Action bundle.
- The generated schema and Action bundle were produced by `pnpm build`; neither
  generated artifact was hand-edited.
- `CHANGELOG.md` describes the release and the package versions agree across
  the workspace.
- The npm package names and target version have been checked on the registry;
  absence of a package is a prerequisite, not proof that publication succeeded.

## Prepare locally

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm verify
pnpm verify:packages
git diff --check
git status --short
```

Inspect the three packed archives before a first publication. Confirm that the
archives contain only the intended `dist` files, metadata, and schema artifact;
never publish from an unreviewed working tree.

## Publish sequence

1. A human maintainer reviews the exact candidate commit and records the
   approval on its pull request.
2. A human maintainer creates and pushes the version tag from that reviewed
   `main` commit.
3. The protected `release` environment is approved by the authorized
   maintainer after rechecking the tag, workflow SHA pins, and verification
   output.
4. Confirm the npm provenance records, package versions, GitHub Release target,
   and generated release notes all refer to the same tag commit.
5. Install each package from a clean consumer project and run the CLI, core
   exports, schema export, and Action bundle smoke checks.
6. Only after those checks pass, document the stable Action reference and
   Marketplace listing in the README and package documentation.

## Failure and rollback

Stop the release if any check is missing, a tag points at the wrong commit, a
package version already exists unexpectedly, provenance is absent, or the
Action bundle differs from the reviewed source build. Do not overwrite a
published version or silently retag it. Record the failure, correct it in a new
reviewed commit, and publish a new patch version only after the full gate is
green again.

An unpublished draft, a local tarball, a successful workflow preparation step,
or a Marketplace form being open is not a release. The authoritative evidence
is the published package metadata, the GitHub Release target, the provenance
record, and a clean-consumer runtime check.
