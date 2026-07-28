export const ACTION_MODES = ['comment', 'check', 'both', 'dry-run'] as const;

export type ActionMode = (typeof ACTION_MODES)[number];

export function parseActionMode(rawMode: string): ActionMode {
  const mode = rawMode.trim() || 'comment';
  if ((ACTION_MODES as readonly string[]).includes(mode)) {
    return mode as ActionMode;
  }

  throw new Error(
    `Invalid mode "${mode}". Expected one of: ${ACTION_MODES.join(', ')}.`,
  );
}

export function parseBooleanInput(rawValue: string, name: string, defaultValue: boolean): boolean {
  const value = rawValue.trim();
  if (!value) return defaultValue;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Invalid ${name} input. Expected "true" or "false".`);
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
