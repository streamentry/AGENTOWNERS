import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import {
  evaluateCapabilities,
  stableCapabilityStringify,
  verifyCapabilityAudit,
} from '../packages/core/dist/index.mjs';

export {
  evaluateCapabilities,
  stableCapabilityStringify as stableStringify,
  verifyCapabilityAudit,
};

export async function runDemo(
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
) {
  const manifest = JSON.parse(
    await readFile(path.join(root, 'fixtures/capabilities/AGENT_CAPABILITIES.json'), 'utf8'),
  );
  const attempts = JSON.parse(
    await readFile(path.join(root, 'fixtures/capabilities/attempts.json'), 'utf8'),
  );
  const result = evaluateCapabilities(manifest, attempts);
  const verification = verifyCapabilityAudit(result);
  if (!verification.valid) {
    throw new Error(`capability audit verification failed: ${verification.code}`);
  }
  for (const [index, attempt] of attempts.entries()) {
    if (result.audit[index]?.decision !== attempt.expected) {
      throw new Error(`fixture ${attempt.attempt_id} produced an unexpected decision`);
    }
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDemo()
    .then((result) => {
      if (process.argv.includes('--summary')) {
        console.log(
          `Capability demo: ${result.summary.allowed} allowed, ${result.summary.denied} denied, kill=${result.summary.kill_triggered}`,
        );
        return;
      }
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(`capability demo failed: ${error.message}`);
      process.exitCode = 1;
    });
}
