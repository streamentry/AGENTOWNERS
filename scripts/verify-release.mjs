import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

async function assertFile(relativePath) {
  await access(resolve(root, relativePath), constants.R_OK)
}

async function verifyCorePackage() {
  const packagePath = resolve(root, 'packages/core/package.json')
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
  const exports = packageJson.exports['.']

  await Promise.all([
    assertFile(`packages/core/${exports.types}`),
    assertFile(`packages/core/${exports.import}`),
    assertFile(`packages/core/${exports.require}`),
  ])

  const imported = await import(
    pathToFileURL(resolve(root, 'packages/core', exports.import)).href
  )
  const required = require(resolve(root, 'packages/core', exports.require))

  if (typeof imported.evaluatePolicy !== 'function') {
    throw new Error('ESM package export does not expose evaluatePolicy')
  }
  if (typeof required.evaluatePolicy !== 'function') {
    throw new Error('CommonJS package export does not expose evaluatePolicy')
  }
}

async function verifyAction() {
  const action = await readFile(resolve(root, 'action.yml'), 'utf8')
  const mainMatch = action.match(/^\s*main:\s*(.+)\s*$/m)

  if (!mainMatch) throw new Error('action.yml does not declare runs.main')
  if (!/^\s*using:\s*node24\s*$/m.test(action)) {
    throw new Error('action.yml must use the supported Node 24 runtime')
  }

  await assertFile(mainMatch[1].trim())
}

async function verifyCli() {
  const cliPath = resolve(root, 'packages/cli/dist/index.js')
  await assertFile('packages/cli/dist/index.js')
  const version = execFileSync(process.execPath, [cliPath, '--version'], {
    encoding: 'utf8',
  }).trim()

  if (version !== '0.1.0') {
    throw new Error(`CLI smoke test returned unexpected version: ${version}`)
  }
}

await Promise.all([verifyCorePackage(), verifyAction(), verifyCli()])
process.stdout.write('Release artifacts verified.\n')
