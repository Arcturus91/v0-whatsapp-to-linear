import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'
import { getEnv } from '@/lib/env'

type MCPClient = Awaited<ReturnType<typeof createMCPClient>>

let cached: Promise<MCPClient> | null = null

/**
 * Returns a process-cached Linear MCP client.
 * The Linear MCP endpoint authenticates via OAuth — we pass a
 * `LINEAR_OAUTH_TOKEN` (a personal API key from
 * linear.app/settings/api works as a fallback) in the Authorization
 * header to skip the interactive OAuth dance for the demo.
 */
export function linearMCP(): Promise<MCPClient> {
  if (cached) return cached
  const env = getEnv()
  if (!env.LINEAR_OAUTH_TOKEN) {
    throw new Error('LINEAR_OAUTH_TOKEN is required to use the Linear MCP client')
  }
  cached = createMCPClient({
    transport: {
      type: 'sse',
      url: 'https://mcp.linear.app/sse',
      headers: { Authorization: `Bearer ${env.LINEAR_OAUTH_TOKEN}` },
    },
  })
  return cached
}

/** Aggregated tool registry from Linear MCP, ready to merge into ToolLoopAgent. */
export async function linearTools() {
  const client = await linearMCP()
  return client.tools()
}
