import { Command } from 'commander'
import { detectAgent } from '@agent-owners/core'
import { getCommitMessage, getCurrentActor } from '../git.js'

export function registerFingerprint(program: Command): void {
  program
    .command('fingerprint')
    .description('Detect agent signals in a commit or local git state')
    .option('--commit <ref>', 'Analyze a specific commit (default: HEAD)', 'HEAD')
    .option('--output <format>', 'Output format: text | json', 'text')
    .action((options: { commit: string; output: string }) => {
      const cwd = process.cwd()
      let commitMessages: string[]
      try {
        commitMessages = getCommitMessage(options.commit, cwd)
      } catch {
        process.stderr.write('Error reading requested commit. Verify the ref and repository.\n')
        process.exit(2)
        return
      }

      const actor = getCurrentActor(cwd) ?? 'unknown'

      const result = detectAgent({ actor, commitMessages })

      if (options.output === 'json') {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
        return
      }

      const lines: string[] = []
      lines.push('Agent detection result:')
      lines.push(`  Confidence: ${result.confidence}`)

      if (result.agentName) {
        lines.push(`  Agent: ${result.agentName}`)
      }

      if (result.signals.length > 0) {
        lines.push('  Signals:')
        for (const signal of result.signals) {
          lines.push(`    - ${signal}`)
        }
      } else {
        lines.push('  Signals: none')
      }

      process.stdout.write(lines.join('\n') + '\n')
    })
}
