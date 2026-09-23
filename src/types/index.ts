// Types definition for Copiloto Comercial IA domain

export type CommercialRole = 'consultor' | 'gestor' | 'admin'
export type AutonomyMode = 'copilot' | 'copilot_automations' | 'autonomous_followup'
export type CommercialStage =
  | 'novo'
  | 'qualificacao'
  | 'oportunidade'
  | 'reuniao'
  | 'proposta'
  | 'negociacao'
  | 'fechado'
  | 'perdido'

export type Temperature = 'fria' | 'morna' | 'quente'
export type WhatsappStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type SuggestionType =
  | 'discovery_question'
  | 'handle_objection'
  | 'explain_concept'
  | 'advance_to_meeting'
  | 'create_followup'
  | 'create_task'
  | 'wait_for_customer'
  | 'send_content'
  | 'request_document'
  | 'escalate_to_manager'
  | 'technical_validation'
  | 'close_opportunity'
  | 'reactivate_opportunity'

export type SuggestionStatus = 'pending' | 'accepted' | 'edited' | 'ignored' | 'deferred'

export type FollowupStatus =
  | 'scheduled'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'cancelled'
  | 'rescheduled'

export interface UserProfile {
  id: string
  user: string
  role: CommercialRole
  organization_id?: string
  autonomy_mode: AutonomyMode
  business_hours?: Array<{ day: string; start: string; end: string; enabled?: boolean }>
  whatsapp_connected: boolean
  google_calendar_connected: boolean
  commercial_labels?: string[]
  created: string
  updated: string
}

export interface WhatsappInstance {
  id: string
  user: string
  instance_name: string
  status: WhatsappStatus
  provider: string
  provider_instance_id?: string
  is_demo: boolean
  created: string
  updated: string
}

export interface Contact {
  id: string
  consultant: string
  whatsapp_instance?: string
  name: string
  phone: string
  profile?: string
  category?: 'lead' | 'customer' | 'partner' | 'nutrition'
  organization_id?: string
  created: string
  updated: string
}

export interface Conversation {
  id: string
  consultant: string
  contact: string
  whatsapp_instance?: string
  commercial_stage: CommercialStage
  temperature: Temperature
  potential_value: number
  product_interest?: string
  objective?: string
  urgency?: string
  pain_point?: string
  motivation?: string
  objections?: string[]
  risk_signals?: string[]
  summary?: string
  next_best_action?: string
  next_action_date?: string
  last_interaction_at?: string
  probability?: string
  pending_items?: string[]
  meeting_scheduled: boolean
  meeting_result?: string
  organization_id?: string
  created: string
  updated: string
  expand?: {
    contact?: Contact
    whatsapp_instance?: WhatsappInstance
  }
}

export interface Message {
  id: string
  consultant: string
  conversation: string
  contact: string
  whatsapp_instance?: string
  direction: 'inbound' | 'outbound'
  message_type: string
  content: string
  timestamp: string
  provider_event_id: string
  metadata?: Record<string, unknown>
  created: string
  updated: string
}

export interface CommercialLabel {
  id: string
  name: string
  color: string
  description?: string
  created: string
  updated: string
}

export interface Opportunity {
  id: string
  consultant: string
  contact: string
  conversation: string
  stage: CommercialStage
  potential_value: number
  product_interest?: string
  status: 'open' | 'won' | 'lost' | 'stalled'
  created: string
  updated: string
  expand?: {
    contact?: Contact
    conversation?: Conversation
  }
}

export interface OpportunityEvent {
  id: string
  opportunity: string
  type: string
  data?: Record<string, unknown>
  created_by?: string
  created: string
}

export interface AiSuggestion {
  id: string
  consultant: string
  conversation: string
  type: SuggestionType
  commercial_stage: CommercialStage
  customer_intent?: string
  objections?: string[]
  purchase_signals?: string[]
  risk_signals?: string[]
  next_best_action: string
  follow_up_required: boolean
  follow_up_date?: string
  meeting_recommended: boolean
  technical_review_required: boolean
  suggested_response?: string[]
  confidence: number
  reasoning_summary: string
  status: SuggestionStatus
  feedback?: string
  suggestion_source?: 'ai' | 'manual'
  created: string
  updated: string
}

export interface Followup {
  id: string
  consultant: string
  conversation: string
  contact: string
  opportunity?: string
  reason: string
  scheduled_date: string
  status: FollowupStatus
  suggested_text: string
  is_automatic: boolean
  source_ai_suggestion?: string
  sent_at?: string
  cancelled_reason?: string
  created: string
  updated: string
  expand?: {
    contact?: Contact
    conversation?: Conversation
  }
}

export interface CommercialTask {
  id: string
  consultant: string
  conversation?: string
  title: string
  description?: string
  due_date?: string
  status: 'open' | 'done' | 'cancelled'
  source: 'manual' | 'ai'
  source_ai_suggestion?: string
  created: string
  updated: string
}

export interface CalendarEvent {
  id: string
  consultant: string
  conversation?: string
  contact?: string
  opportunity?: string
  provider_event_id?: string
  title: string
  date: string
  meeting_type?: string
  status: 'scheduled' | 'done' | 'cancelled'
  created: string
  updated: string
  expand?: {
    contact?: Contact
  }
}

export interface KnowledgeDocument {
  id: string
  title: string
  category?: string
  version?: string
  valid_until?: string
  responsible?: string
  published_at?: string
  status: 'approved' | 'not_approved'
  content?: string
  created: string
  updated: string
}

export interface AuditLog {
  id: string
  user?: string
  action: string
  entity_type?: string
  entity_id?: string
  details?: Record<string, unknown>
  created: string
}

export interface AlertItem {
  id: string
  priority: 'CRITICA' | 'ACAO_NECESSARIA' | 'OPORTUNIDADE' | 'INFORMATIVA'
  title: string
  description: string
  timestamp: string
  actionUrl?: string
}
