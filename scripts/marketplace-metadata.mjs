import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const require = createRequire(resolve(import.meta.dirname, '../packages/core/package.json'));
const { load } = require('js-yaml');

function requireRecord(value, field, relativePath) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${relativePath} must declare ${field} as a mapping.`);
  }
  return value;
}

function requireText(metadata, field, relativePath) {
  const value = metadata[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${relativePath} must declare a non-empty ${field}.`);
  }
}

async function parseMetadata(root, relativePath) {
  let parsed;
  try {
    parsed = load(await readFile(resolve(root, relativePath), 'utf8'));
  } catch (error) {
    throw new Error(
      `Invalid action metadata in ${relativePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return requireRecord(parsed, 'metadata document', relativePath);
}

async function existingRootMetadata(root) {
  const candidates = ['action.yml', 'action.yaml'];
  const results = await Promise.all(
    candidates.map(async (relativePath) => {
      try {
        await access(resolve(root, relativePath), constants.R_OK);
        return relativePath;
      } catch {
        return null;
      }
    }),
  );
  return results.filter(Boolean);
}

function validateShape(metadata, relativePath, expectedMain) {
  for (const field of ['name', 'description', 'author']) {
    requireText(metadata, field, relativePath);
  }
  const branding = requireRecord(metadata.branding, 'branding', relativePath);
  requireText(branding, 'icon', `${relativePath} branding`);
  requireText(branding, 'color', `${relativePath} branding`);
  requireRecord(metadata.inputs, 'inputs', relativePath);
  requireRecord(metadata.outputs, 'outputs', relativePath);
  const runs = requireRecord(metadata.runs, 'runs', relativePath);
  if (runs.using !== 'node24') {
    throw new Error(`${relativePath} must use the supported Node 24 runtime.`);
  }
  if (runs.main !== expectedMain) {
    throw new Error(`${relativePath} must declare runs.main as ${expectedMain}.`);
  }
}

function comparableMetadata(metadata) {
  return {
    ...metadata,
    author: '<distribution-specific-author>',
    runs: {
      ...metadata.runs,
      main: '<distribution-relative-action-bundle>',
    },
  };
}

export async function verifyMarketplaceMetadata(root) {
  const rootMetadataFiles = await existingRootMetadata(root);
  if (rootMetadataFiles.length !== 1) {
    throw new Error('Marketplace publication requires exactly one root action.yml or action.yaml.');
  }

  const rootRelativePath = rootMetadataFiles[0];
  const packageRelativePath = 'packages/github-action/action.yml';
  const [rootMetadata, packageMetadata] = await Promise.all([
    parseMetadata(root, rootRelativePath),
    parseMetadata(root, packageRelativePath),
  ]);

  validateShape(rootMetadata, rootRelativePath, 'packages/github-action/dist/index.js');
  validateShape(packageMetadata, packageRelativePath, 'dist/index.js');
  if (!isDeepStrictEqual(comparableMetadata(rootMetadata), comparableMetadata(packageMetadata))) {
    throw new Error('Root and packaged Action metadata drift outside author and runs.main.');
  }

  await access(resolve(root, 'packages/github-action/dist/index.js'), constants.R_OK);
}
