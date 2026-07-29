import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { parsePolicy } from '../src/schema.js';

const repositoryRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../../..');

const policyTemplates = [
  '.github/AGENTOWNERS.yml',
  '.github/AGENTOWNERS.yml.example',
] as const;

describe('repository-owned policy templates', () => {
  it.each(policyTemplates)('%s parses through the strict public schema', (relativePath) => {
    const contents = readFileSync(join(repositoryRoot, relativePath), 'utf8');

    expect(() => parsePolicy(yaml.load(contents))).not.toThrow();
  });
});
