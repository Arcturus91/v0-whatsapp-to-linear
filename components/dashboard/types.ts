export type IssuePriority = '1' | '2' | '3' | '4'

export interface DashboardMetrics {
  totalEvents: number
  eventTypes: Record<string, number>
}

export interface DashboardEvent {
  id: string
  type: 'whatsapp.message' | 'linear.event' | 'bot.response' | 'voice.transcribed'
  timestamp: number
  conversationId: string
  author: string
  content: string
  rawPayload: Record<string, unknown>
}

export interface IssueDraft {
  title: string
  context: string
  tasks: string
  acceptanceCriteria: string
  references: string
  team: string
  priority: IssuePriority
  project: string
  labels: string
  assignee: string
  dueDate: string
  blockedBy: string
  blocks: string
  estimatedDays: string
  duplicateCheck: string
}
