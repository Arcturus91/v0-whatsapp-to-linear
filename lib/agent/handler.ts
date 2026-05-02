import { generateText } from 'ai';
import { tools } from './tools';

const MODEL = 'anthropic.claude-3-5-sonnet-20241022';

export interface AgentContext {
  conversationId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  userPhoneNumber: string;
  metadata?: Record<string, any>;
}

export async function processMessageWithAgent(
  context: AgentContext,
  userMessage: string
): Promise<string> {
  try {
    console.log(`[v0] Processing message with agent`, {
      conversationId: context.conversationId,
      messageLength: userMessage.length,
    });

    // Convert conversation history to AI SDK format
    const messages = context.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Add current message
    messages.push({
      role: 'user' as const,
      content: userMessage,
    });

    // Generate response using Claude via AI Gateway
    const result = await generateText({
      model: MODEL as any,
      messages,
      system: `You are LinearVoice, an AI assistant for WhatsApp that helps users manage their Linear project management tasks. You can:
1. Create, search, and update Linear issues
2. Handle voice interactions and transcriptions
3. Store and retrieve user preferences and context
4. Provide project management guidance

Be conversational and helpful. When a user asks to create an issue, create one. When they ask about their project, search for relevant issues. Keep responses concise for WhatsApp (max 500 chars per message).`,
    });

    console.log(`[v0] Agent response generated`, {
      conversationId: context.conversationId,
      responseLength: result.text.length,
      toolUsed: result.toolResults?.length ? true : false,
    });

    return result.text;
  } catch (error) {
    console.error('[v0] Agent error:', error);
    throw error;
  }
}

// For simple echo mode (fallback)
export async function processMessageEcho(userMessage: string): Promise<string> {
  return `Echo: ${userMessage}`;
}
