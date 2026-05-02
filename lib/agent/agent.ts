import { ToolLoopAgent, gateway, stepCountIs } from 'ai'
import { linearTools } from './mcp'
import { SYSTEM_PROMPT } from './system-prompt'

/**
 * Build a ToolLoopAgent backed by Linear MCP tools.
 *
 * Model is routed through the AI Gateway with a `models` fallback list,
 * so an outage or quota issue on the primary provider transparently
 * fails over. Tags surface in Vercel's gateway dashboard for cost
 * accounting.
 */
export async function buildAgent(): Promise<ToolLoopAgent<never, Awaited<ReturnType<typeof linearTools>>>> {
  const tools = await linearTools()
  return new ToolLoopAgent({
    model: gateway('anthropic/claude-sonnet-4.6'),
    instructions: SYSTEM_PROMPT,
    tools,
    stopWhen: stepCountIs(8),
    providerOptions: {
      gateway: {
        models: ['anthropic/claude-haiku-4.5'],
        tags: ['feature:linearvoice', 'env:hackathon'],
      },
    },
  })
}
