import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readMetadata(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('GitHub Action metadata', () => {
  it('declares the audit artifact output in both published entry points', () => {
    for (const path of ['../../../action.yml', '../action.yml']) {
      const metadata = readMetadata(path);
      expect(metadata).toMatch(
        /audit-artifact:\n\s+description: .+agentowners-decision\.json audit artifact/,
      );
    }
  });

  it('keeps the bundled Action on the Node 24 runtime', () => {
    expect(readMetadata('../../../action.yml')).toMatch(/using: node24/);
    expect(readMetadata('../action.yml')).toMatch(/using: node24/);
  });
});
