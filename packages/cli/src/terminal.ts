const ANSI_ESCAPE = new RegExp(
  String.raw`\u001B(?:\][^\u0007]*(?:\u0007|\u001B\\)|\[[0-?]*[ -/]*[@-~])`,
  'g',
);
const TERMINAL_CONTROLS = new RegExp(
  String.raw`[\u0000-\u0008\u000B-\u000D\u000E-\u001F\u007F]`,
  'g',
);

export function sanitizeTerminalText(value: string): string {
  return value.replace(ANSI_ESCAPE, '').replace(TERMINAL_CONTROLS, '');
}

export function sanitizeTerminalInlineText(value: string): string {
  return sanitizeTerminalText(value).replace(/\n/g, ' ');
}
