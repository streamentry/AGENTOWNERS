import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { deriveReleaseTags, runFile, updateMajorTag } from './release-automation.mjs';

const root = resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const { releaseTag } = deriveReleaseTags(packageJson.version);

if (process.env.GITHUB_REF_NAME !== releaseTag) {
  throw new Error(
    `Release ref ${process.env.GITHUB_REF_NAME ?? '(missing)'} must equal ${releaseTag}`,
  );
}

const majorTag = await updateMajorTag({
  root,
  run: runFile,
  sha: process.env.GITHUB_SHA ?? '',
  version: packageJson.version,
});

process.stdout.write(
  majorTag
    ? `Updated ${majorTag} to ${process.env.GITHUB_SHA}.\n`
    : 'Prerelease: major tag unchanged.\n',
);
