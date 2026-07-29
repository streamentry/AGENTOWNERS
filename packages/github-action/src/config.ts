export const ACTION_MODES = ['comment', 'check', 'both', 'dry-run'] as const;

export type ActionMode = (typeof ACTION_MODES)[number];

export function parseActionMode(input: string): ActionMode {
  if (input === '') return 'comment';
  if ((ACTION_MODES as readonly string[]).includes(input)) return input as ActionMode;
  throw new Error('Invalid mode. Expected one of: comment, check, both, dry-run.');
}

export function requireGitHubToken(
  environmentToken: string | undefined,
  inputToken: string,
): string {
  const token = environmentToken ?? inputToken;
  if (!token) {
    throw new Error('Missing github-token input. Pass github-token: ${{ secrets.GITHUB_TOKEN }}.');
  }
  return token;
}
