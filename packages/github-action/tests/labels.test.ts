import { describe, expect, it, vi } from 'vitest';
import { applyLabels, labelsToAdd, riskLabelsToRemove } from '../src/labels.js';

describe('risk-label reconciliation', () => {
  it('adds only missing labels and removes only stale reserved risk labels', async () => {
    const mockOctokit = {
      rest: {
        issues: {
          getLabel: vi.fn().mockResolvedValue({ data: {} }),
          createLabel: vi.fn(),
          addLabels: vi.fn().mockResolvedValue({ data: [] }),
          removeLabel: vi.fn().mockResolvedValue({ data: {} }),
        },
      },
    };

    await applyLabels(
      mockOctokit as never,
      'owner',
      'repo',
      7,
      ['ai-agent', 'risk-high', 'security-review', 'keep-me'],
      ['ai-agent', 'risk-medium', 'security-review'],
    );

    expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: 7,
      labels: ['risk-medium'],
    });
    expect(mockOctokit.rest.issues.removeLabel).toHaveBeenCalledTimes(1);
    expect(mockOctokit.rest.issues.removeLabel).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: 7,
      name: 'risk-high',
    });
    expect(mockOctokit.rest.issues.createLabel).not.toHaveBeenCalled();
  });

  it('preserves user and policy labels while calculating reconciliation', () => {
    expect(labelsToAdd(['ai-agent', 'security-review'], ['ai-agent', 'security-review'])).toEqual(
      [],
    );
    expect(riskLabelsToRemove(['security-review', 'risk-low'], ['security-review', 'risk-low'])).toEqual(
      [],
    );
    expect(riskLabelsToRemove(['security-review', 'risk-critical'], ['security-review', 'risk-low'])).toEqual(
      ['risk-critical'],
    );
  });
});
