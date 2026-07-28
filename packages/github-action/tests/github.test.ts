import { describe, expect, it, vi } from 'vitest';
import {
  classifyFiles,
  detectAgent,
  evaluatePolicy,
  inferActions,
  type AgentOwnersPolicy,
} from '@agent-owners/core';
import { getPRFiles } from '../src/github.js';

function createOctokit(pages: unknown[][]) {
  const listFiles = vi.fn();
  for (const page of pages) {
    listFiles.mockResolvedValueOnce({ data: page });
  }
  return {
    octokit: { rest: { pulls: { listFiles } } },
    listFiles,
  };
}

describe('getPRFiles rename boundaries', () => {
  it('retains renamed source and destination paths exactly once across pages', async () => {
    const firstPage = [
      {
        filename: 'config/runtime.txt',
        previous_filename: '.env.production',
        status: 'renamed',
      },
      ...Array.from({ length: 99 }, (_, index) => ({ filename: `src/file-${index}.ts` })),
    ];
    const { octokit, listFiles } = createOctokit([
      firstPage,
      [
        {
          filename: 'config/runtime.txt',
          previous_filename: '.env.production',
          status: 'renamed',
        },
      ],
    ]);

    const result = await getPRFiles(octokit as never, 'owner', 'repo', 7);

    expect(result.files.filter((path) => path === 'config/runtime.txt')).toHaveLength(1);
    expect(result.files.filter((path) => path === '.env.production')).toHaveLength(1);
    expect(result.files.slice(0, 2)).toEqual(['config/runtime.txt', '.env.production']);
    expect(listFiles).toHaveBeenCalledTimes(2);
  });

  it('ignores previous filenames on non-renames and empty or unchanged rename sources', async () => {
    const { octokit } = createOctokit([
      [
        {
          filename: 'src/index.ts',
          previous_filename: '.env',
          status: 'modified',
          patch: '+safe change',
        },
        { filename: 'docs/guide.md', previous_filename: '', status: 'renamed', patch: '+guide' },
        {
          filename: 'README.md',
          previous_filename: 'README.md',
          status: 'renamed',
          patch: '+readme',
        },
      ],
    ]);

    await expect(getPRFiles(octokit as never, 'owner', 'repo', 8)).resolves.toMatchObject({
      files: ['src/index.ts', 'docs/guide.md', 'README.md'],
      patchesComplete: true,
    });
  });

  it('keeps a renamed secret source in the production policy pipeline', async () => {
    const { octokit } = createOctokit([
      [
        {
          filename: 'config/runtime.txt',
          previous_filename: '.env.production',
          status: 'renamed',
        },
      ],
    ]);
    const { files } = await getPRFiles(octokit as never, 'owner', 'repo', 9);
    const policy: AgentOwnersPolicy = {
      version: 1,
      agents: {
        rename_agent: {
          match: { actors: ['rename-agent[bot]'] },
          allowed: ['open_pr'],
        },
      },
      defaults: { known_agent: 'allow', secrets: 'block' },
    };
    const filesClassification = classifyFiles(files);
    const agentDetection = detectAgent({ actor: 'rename-agent[bot]', policy });
    const detectedActions = inferActions({
      eventType: 'pull_request.opened',
      changedFiles: files,
      filesClassification,
    });

    expect(filesClassification.secretFilesDetected).toBe(true);
    expect(detectedActions).toContain('touch_secrets');
    expect(
      evaluatePolicy({
        policy,
        agentDetection,
        detectedActions,
        changedFiles: files,
        filesClassification,
        actor: 'rename-agent[bot]',
      }).effect,
    ).toBe('block');
  });
});
