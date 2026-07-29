import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getCliVersion } from '../src/version.js';

type PackageMetadata = { version: string };

const packageMetadata = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', 'package.json'), 'utf8'),
) as PackageMetadata;

describe('CLI version contract', () => {
  it('reads the published package version from package metadata', () => {
    expect(getCliVersion()).toBe(packageMetadata.version);
  });
});
