import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Keep this list explicit: these files are the first-stop contract for humans
// and agents, so adding a document to the gate should be an intentional review.
export const CRITICAL_DOCUMENTS = Object.freeze([
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'SKILL.md',
  'CLAUDE.md',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
  'packages/core/README.md',
  'packages/cli/README.md',
  'packages/github-action/README.md',
  'packages/core/AGENTS.md',
  'packages/cli/AGENTS.md',
  'packages/github-action/AGENTS.md',
  '.github/copilot-instructions.md',
  '.github/agents/AGENTS.md',
]);

function localDestination(rawDestination) {
  const raw = rawDestination.trim();
  if (!raw || raw.startsWith('#') || /^(?:https?:|mailto:|data:|\/\/)/i.test(raw)) {
    return null;
  }

  const destination = raw.startsWith('<') ? raw.slice(1, raw.indexOf('>')) : raw.split(/\s+/)[0];
  return destination.split('#', 1)[0].split('?', 1)[0] || null;
}

export function findMissingTargets(root, documents = CRITICAL_DOCUMENTS, contents = new Map()) {
  const missing = [];

  for (const document of documents) {
    const documentPath = resolve(root, document);
    const source = contents.get(document) ?? readDocument(documentPath);
    if (source === null) {
      missing.push({ document, target: null, reason: 'document is missing' });
      continue;
    }

    for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)\n]+)\)/g)) {
      const target = localDestination(match[1]);
      if (target === null) continue;
      if (!existsSync(resolve(dirname(documentPath), target))) {
        missing.push({ document, target, reason: 'local target is missing' });
      }
    }
  }

  return missing;
}

function readDocument(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export function verifyDocs(root = ROOT, documents = CRITICAL_DOCUMENTS) {
  const missing = findMissingTargets(root, documents);
  if (missing.length > 0) {
    const details = missing
      .map(({ document, target, reason }) => `${document}: ${target ?? '<document>'} (${reason})`)
      .join('\n');
    throw new Error(`Documentation path verification failed:\n${details}`);
  }

  return { checkedDocuments: documents.length };
}

if (pathToFileURL(resolve(process.argv[1] ?? '')).href === import.meta.url) {
  const result = verifyDocs();
  process.stdout.write(`Documentation paths verified (${result.checkedDocuments} critical documents).\n`);
}
