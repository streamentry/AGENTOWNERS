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
