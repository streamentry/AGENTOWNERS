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

function filePage(page: number, size = 100) {
  return Array.from({ length: size }, (_, index) => ({
    filename: `src/page-${page}-file-${index}.ts`,
    status: 'modified',
    patch: '+safe change',
  }));
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

describe('getPRFiles completeness boundaries', () => {
  it('rejects a declared file count above GitHub API limits before listing files', async () => {
    const { octokit, listFiles } = createOctokit([]);

    await expect(getPRFiles(octokit as never, 'owner', 'repo', 10, 3001)).rejects.toThrow(
      '3,000',
    );
    expect(listFiles).not.toHaveBeenCalled();
  });

  it('stops on an exact declared count even when the final page is full', async () => {
    const { octokit, listFiles } = createOctokit([filePage(1), filePage(2)]);

    const result = await getPRFiles(octokit as never, 'owner', 'repo', 11, 200);

    expect(result.files).toHaveLength(200);
    expect(listFiles).toHaveBeenCalledTimes(2);
  });

  it('rejects an API result that finishes below the declared count', async () => {
    const { octokit } = createOctokit([[{ filename: 'src/only.ts', status: 'modified' }]]);

    await expect(getPRFiles(octokit as never, 'owner', 'repo', 12, 2)).rejects.toThrow(
      'reported 2 files but returned 1',
    );
  });

  it('rejects an API result that exceeds the declared count', async () => {
    const { octokit } = createOctokit([
      [
        { filename: 'src/first.ts', status: 'modified' },
        { filename: 'src/unexpected.ts', status: 'modified' },
      ],
    ]);

    await expect(getPRFiles(octokit as never, 'owner', 'repo', 13, 1)).rejects.toThrow(
      'returned more than',
    );
  });

  it('accepts exactly 3,000 files when the declared count proves completeness', async () => {
    const pages = Array.from({ length: 30 }, (_, index) => filePage(index + 1));
    const { octokit, listFiles } = createOctokit(pages);

    const result = await getPRFiles(octokit as never, 'owner', 'repo', 14, 3000);

    expect(result.files).toHaveLength(3000);
    expect(listFiles).toHaveBeenCalledTimes(30);
  });

  it('rejects an ambiguous full 3,000-file result without a declared count', async () => {
    const pages = Array.from({ length: 30 }, (_, index) => filePage(index + 1));
    const { octokit, listFiles } = createOctokit(pages);

    await expect(getPRFiles(octokit as never, 'owner', 'repo', 15)).rejects.toThrow('3,000');
    expect(listFiles).toHaveBeenCalledTimes(30);
  });
});
