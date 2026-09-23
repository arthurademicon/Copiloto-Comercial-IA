import pb from '@/lib/pocketbase/client'
import type {
  Conversation,
  Message,
  Contact,
  Opportunity,
  OpportunityEvent,
  AiSuggestion,
  Followup,
  CommercialTask,
  CalendarEvent,
  KnowledgeDocument,
  CommercialLabel,
  AuditLog,
} from '@/types'

export const copilotService = {
  // Conversations
  async getConversations(userId: string): Promise<Conversation[]> {
    return await pb.collection('conversations').getFullList<Conversation>({
      filter: `consultant="${userId}"`,
      sort: '-last_interaction_at',
      expand: 'contact,whatsapp_instance',
    })
  },

  async getConversation(id: string): Promise<Conversation> {
    return await pb.collection('conversations').getOne<Conversation>(id, {
      expand: 'contact,whatsapp_instance',
    })
  },

  async updateConversationStage(
    id: string,
    stage: Conversation['commercial_stage'],
    notes?: string,
  ): Promise<Conversation> {
    const updated = await pb.collection('conversations').update<Conversation>(id, {
      commercial_stage: stage,
    })

    // Also update matching opportunity if exists
    try {
      const opp = await pb
        .collection('opportunities')
        .getFirstListItem<Opportunity>(`conversation="${id}"`)
      await pb.collection('opportunities').update(opp.id, {
        stage,
        status: stage === 'fechado' ? 'won' : stage === 'perdido' ? 'lost' : 'open',
      })
      await pb.collection('opportunity_events').create<OpportunityEvent>({
        opportunity: opp.id,
        type: 'stage_change',
        data: { new_stage: stage, notes: notes || '' },
        created_by: pb.authStore.record?.id,
      })
    } catch {
      /* intentionally ignored */
    }

    return updated
  },

  // Messages
  async getMessages(conversationId: string): Promise<Message[]> {
    return await pb.collection('messages').getFullList<Message>({
      filter: `conversation="${conversationId}"`,
      sort: 'timestamp',
    })
  },

  // AI Suggestions
  async getAiSuggestions(userId: string): Promise<AiSuggestion[]> {
    return await pb.collection('ai_suggestions').getFullList<AiSuggestion>({
      filter: `consultant="${userId}"`,
      sort: '-created',
    })
  },

  async getSuggestionsForConversation(conversationId: string): Promise<AiSuggestion[]> {
    return await pb.collection('ai_suggestions').getFullList<AiSuggestion>({
      filter: `conversation="${conversationId}"`,
      sort: '-created',
    })
  },

  async updateSuggestionStatus(
    id: string,
    status: AiSuggestion['status'],
    feedback?: string,
  ): Promise<AiSuggestion> {
    const updated = await pb.collection('ai_suggestions').update<AiSuggestion>(id, {
      status,
      feedback: feedback || '',
    })

    // Record audit log
    try {
      await pb.collection('audit_logs').create<AuditLog>({
        user: pb.authStore.record?.id,
        action: `ai_suggestion_${status}`,
        entity_type: 'ai_suggestions',
        entity_id: id,
        details: { feedback: feedback || '' },
      })
    } catch {
      /* intentionally ignored */
    }

    return updated
  },

  async triggerCopilotAnalysis(conversationId: string): Promise<void> {
    await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/copilot/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify({ conversation_id: conversationId }),
    })
  },

  // Follow-ups
  async getFollowups(userId: string): Promise<Followup[]> {
    return await pb.collection('followups').getFullList<Followup>({
      filter: `consultant="${userId}"`,
      sort: 'scheduled_date',
      expand: 'contact,conversation',
    })
  },

  async updateFollowupStatus(
    id: string,
    status: Followup['status'],
    cancelledReason?: string,
  ): Promise<Followup> {
    return await pb.collection('followups').update<Followup>(id, {
      status,
      cancelled_reason: cancelledReason || '',
      sent_at: status === 'sent' ? new Date().toISOString() : undefined,
    })
  },

  async rescheduleFollowup(id: string, newDate: string): Promise<Followup> {
    return await pb.collection('followups').update<Followup>(id, {
      scheduled_date: newDate,
      status: 'rescheduled',
    })
  },

  // Opportunities
  async getOpportunities(userId: string): Promise<Opportunity[]> {
    return await pb.collection('opportunities').getFullList<Opportunity>({
      filter: `consultant="${userId}"`,
      sort: '-created',
      expand: 'contact,conversation',
    })
  },

  // Tasks
  async getTasks(userId: string): Promise<CommercialTask[]> {
    return await pb.collection('tasks').getFullList<CommercialTask>({
      filter: `consultant="${userId}"`,
      sort: 'due_date',
    })
  },

  async updateTaskStatus(id: string, status: CommercialTask['status']): Promise<CommercialTask> {
    return await pb.collection('tasks').update<CommercialTask>(id, { status })
  },

  // Calendar
  async getCalendarEvents(userId: string): Promise<CalendarEvent[]> {
    return await pb.collection('calendar_events').getFullList<CalendarEvent>({
      filter: `consultant="${userId}"`,
      sort: 'date',
      expand: 'contact',
    })
  },

  async createCalendarEvent(payload: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return await pb.collection('calendar_events').create<CalendarEvent>({
      consultant: pb.authStore.record?.id,
      title: payload.title || 'Reunião Comercial',
      date: payload.date || new Date().toISOString(),
      meeting_type: payload.meeting_type || 'Videoconferência',
      status: 'scheduled',
      conversation: payload.conversation,
      contact: payload.contact,
      opportunity: payload.opportunity,
      provider_event_id: `gcal_evt_${Date.now()}`,
    })
  },

  // Knowledge
  async getKnowledgeDocs(): Promise<KnowledgeDocument[]> {
    return await pb.collection('knowledge_documents').getFullList<KnowledgeDocument>({
      sort: '-published_at',
    })
  },

  // Labels
  async getCommercialLabels(): Promise<CommercialLabel[]> {
    return await pb.collection('commercial_labels').getFullList<CommercialLabel>({
      sort: 'name',
    })
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    return await pb.collection('audit_logs').getFullList<AuditLog>({
      sort: '-created',
    })
  },
}
