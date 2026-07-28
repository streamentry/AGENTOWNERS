import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const agentsDirectory = join(repositoryRoot, '.github', 'agents');

function readAgentProfile(fileName: string): {
  frontmatter: Record<string, unknown>;
  prompt: string;
} {
  const source = readFileSync(join(agentsDirectory, fileName), 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`${fileName} must contain YAML frontmatter`);

  const parsed = load(match[1] ?? '');
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${fileName} frontmatter must be an object`);
  }

  return {
    frontmatter: parsed as Record<string, unknown>,
    prompt: match[2] ?? '',
  };
}

describe('repository custom agents', () => {
  it('gives every agent profile a non-empty description and prompt', () => {
    const profiles = readdirSync(agentsDirectory)
      .filter((fileName) => fileName.endsWith('.agent.md'))
      .sort();

    expect(profiles.length).toBeGreaterThan(0);
    for (const fileName of profiles) {
      const { frontmatter, prompt } = readAgentProfile(fileName);
      expect(frontmatter['description'], `${fileName} description`).toEqual(expect.any(String));
      expect((frontmatter['description'] as string).trim(), `${fileName} description`).not.toBe('');
      expect(prompt.trim(), `${fileName} prompt`).not.toBe('');
    }
  });

  it('keeps the adversarial reviewer manual, read-only, and non-approving', () => {
    const { frontmatter, prompt } = readAgentProfile('adversarial-reviewer.agent.md');

    expect(frontmatter['tools']).toEqual(['read', 'search']);
    expect(frontmatter['disable-model-invocation']).toBe(true);
    expect(frontmatter['user-invocable']).toBe(true);
    expect(prompt).toContain('not independent approval');
    expect(frontmatter['tools']).not.toEqual(expect.arrayContaining(['edit', 'execute']));
  });
});
