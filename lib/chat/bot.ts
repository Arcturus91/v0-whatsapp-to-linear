import { getEnv } from '../env';
import { emitWhatsAppMessage, emitBotResponse, getConversationState, saveConversationState } from '../events/emit';
import { WhatsAppMessage, ConversationState } from '../events/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class LinearVoiceBot {
  private conversationStates: Map<string, ConversationState> = new Map();
  private env = getEnv();

  async processIncomingMessage(message: WhatsAppMessage): Promise<string> {
    console.log(`[v0] Processing message from ${message.from}: ${message.text}`);

    // Emit the incoming message to event stream
    await emitWhatsAppMessage(message);

    // Get or create conversation state
    let state = this.conversationStates.get(message.from);
    if (!state) {
      const savedState = await getConversationState(message.from);
      state = savedState || {
        id: message.from,
        userId: message.from,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    // Ensure state is defined
    if (!state) {
      state = {
        id: message.from,
        userId: message.from,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    // Add user message to history
    state.messages.push({
      role: 'user',
      content: message.text || '[media]',
      timestamp: message.timestamp,
    });

    // For now: echo the message back (stub)
    // TODO: Replace with real ToolLoopAgent in step 3
    const response = `Echo: ${message.text}`;

    // Add bot response to history
    state.messages.push({
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    });

    // Save state
    state.updatedAt = Date.now();
    this.conversationStates.set(message.from, state);
    await saveConversationState(message.from, state);

    // Emit bot response
    await emitBotResponse({
      id: `${message.from}-${Date.now()}`,
      conversationId: message.from,
      userId: message.from,
      type: 'message',
      content: response,
      timestamp: Date.now(),
    });

    return response;
  }

  getConversationState(userId: string): ConversationState | undefined {
    return this.conversationStates.get(userId);
  }

  getAllConversations(): ConversationState[] {
    return Array.from(this.conversationStates.values());
  }

  clearConversation(userId: string): void {
    this.conversationStates.delete(userId);
  }
}

let botInstance: LinearVoiceBot | null = null;

export function getBot(): LinearVoiceBot {
  if (!botInstance) {
    botInstance = new LinearVoiceBot();
  }
  return botInstance;
}
