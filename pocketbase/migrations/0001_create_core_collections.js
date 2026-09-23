/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('users')
    const usersId = usersCollection.id

    // 1. user_profiles
    const userProfiles = new Collection({
      name: 'user_profiles',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'role',
          type: 'select',
          required: true,
          values: ['consultor', 'gestor', 'admin'],
          maxSelect: 1,
        },
        { name: 'organization_id', type: 'text' },
        {
          name: 'autonomy_mode',
          type: 'select',
          required: true,
          values: ['copilot', 'copilot_automations', 'autonomous_followup'],
          maxSelect: 1,
        },
        { name: 'business_hours', type: 'json' },
        { name: 'whatsapp_connected', type: 'bool' },
        { name: 'google_calendar_connected', type: 'bool' },
        { name: 'commercial_labels', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_user_profiles_user ON user_profiles (user)'],
    })
    app.save(userProfiles)

    // 2. whatsapp_instances
    const whatsappInstances = new Collection({
      name: 'whatsapp_instances',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'instance_name', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['disconnected', 'connecting', 'connected', 'error'],
          maxSelect: 1,
        },
        { name: 'provider', type: 'text', required: true },
        { name: 'provider_instance_id', type: 'text' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_wainstances_user ON whatsapp_instances (user)',
        'CREATE INDEX idx_wainstances_status ON whatsapp_instances (status)',
      ],
    })
    app.save(whatsappInstances)
    const waInstanceId = whatsappInstances.id

    // 3. commercial_labels (Global label catalog)
    const commercialLabels = new Collection({
      name: 'commercial_labels',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'color', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_labels_name ON commercial_labels (name)'],
    })
    app.save(commercialLabels)
    const commLabelsId = commercialLabels.id

    // 4. contacts
    const contacts = new Collection({
      name: 'contacts',
      type: 'base',
      listRule: "@request.auth.id != '' && consultant = @request.auth.id",
      viewRule: "@request.auth.id != '' && consultant = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && consultant = @request.auth.id",
      deleteRule: "@request.auth.id != '' && consultant = @request.auth.id",
      fields: [
        { name: 'organization_id', type: 'text' },
        {
          name: 'consultant',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'whatsapp_instance',
          type: 'relation',
          collectionId: waInstanceId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true },
        { name: 'phone', type: 'text', required: true },
        { name: 'profile', type: 'text' },
        {
          name: 'category',
          type: 'select',
          values: ['lead', 'customer', 'partner', 'nutrition'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contacts_consultant ON contacts (consultant)',
        'CREATE INDEX idx_contacts_phone ON contacts (phone)',
      ],
    })
    app.save(contacts)
    const contactsId = contacts.id

    // 5. conversations
    const conversations = new Collection({
      name: 'conversations',
      type: 'base',
      listRule: "@request.auth.id != '' && consultant = @request.auth.id",
      viewRule: "@request.auth.id != '' && consultant = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && consultant = @request.auth.id",
      deleteRule: "@request.auth.id != '' && consultant = @request.auth.id",
      fields: [
        { name: 'organization_id', type: 'text' },
        {
          name: 'consultant',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'contact',
          type: 'relation',
          required: true,
          collectionId: contactsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'whatsapp_instance',
          type: 'relation',
          collectionId: waInstanceId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'commercial_stage',
          type: 'select',
          required: true,
          values: [
            'novo',
            'qualificacao',
            'oportunidade',
            'reuniao',
            'proposta',
            'negociacao',
            'fechado',
            'perdido',
          ],
          maxSelect: 1,
        },
        { name: 'temperature', type: 'select', values: ['fria', 'morna', 'quente'], maxSelect: 1 },
        { name: 'potential_value', type: 'number' },
        { name: 'product_interest', type: 'text' },
        { name: 'objective', type: 'text' },
        { name: 'urgency', type: 'text' },
        { name: 'pain_point', type: 'text' },
        { name: 'motivation', type: 'text' },
        { name: 'objections', type: 'json' },
        { name: 'risk_signals', type: 'json' },
        { name: 'summary', type: 'text' },
        { name: 'next_best_action', type: 'text' },
        { name: 'next_action_date', type: 'date' },
        { name: 'last_interaction_at', type: 'date' },
        { name: 'probability', type: 'text' },
        { name: 'pending_items', type: 'json' },
        { name: 'meeting_scheduled', type: 'bool' },
        { name: 'meeting_result', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_conv_consultant ON conversations (consultant)',
        'CREATE INDEX idx_conv_stage ON conversations (commercial_stage)',
        'CREATE INDEX idx_conv_last_inter ON conversations (last_interaction_at)',
        'CREATE INDEX idx_conv_next_act ON conversations (next_action_date)',
      ],
    })
    app.save(conversations)
    const convId = conversations.id

    // 6. conversation_labels
    const conversationLabels = new Collection({
      name: 'conversation_labels',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'conversation',
          type: 'relation',
          required: true,
          collectionId: convId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'label',
          type: 'relation',
          required: true,
          collectionId: commLabelsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_conv_labels_conv ON conversation_labels (conversation)'],
    })
    app.save(conversationLabels)

    // 7. messages (provider_event_id is UNIQUE for idempotency)
    const messages = new Collection({
      name: 'messages',
      type: 'base',
      listRule: "@request.auth.id != '' && consultant = @request.auth.id",
      viewRule: "@request.auth.id != '' && consultant = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && consultant = @request.auth.id",
      deleteRule: "@request.auth.id != '' && consultant = @request.auth.id",
      fields: [
        { name: 'organization_id', type: 'text' },
        {
          name: 'consultant',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'conversation',
          type: 'relation',
          required: true,
          collectionId: convId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'contact',
          type: 'relation',
          required: true,
          collectionId: contactsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'whatsapp_instance',
          type: 'relation',
          collectionId: waInstanceId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'direction',
          type: 'select',
          required: true,
          values: ['inbound', 'outbound'],
          maxSelect: 1,
        },
        { name: 'message_type', type: 'text', required: true },
        { name: 'content', type: 'text', required: true },
        { name: 'timestamp', type: 'date', required: true },
        { name: 'provider_event_id', type: 'text', required: true },
        { name: 'metadata', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_messages_provider_id ON messages (provider_event_id)',
        'CREATE INDEX idx_messages_conv ON messages (conversation)',
        'CREATE INDEX idx_messages_timestamp ON messages (timestamp)',
      ],
    })
    app.save(messages)

    // 8. opportunities
    const opportunities = new Collection({
      name: 'opportunities',
      type: 'base',
      listRule: "@request.auth.id != '' && consultant = @request.auth.id",
      viewRule: "@request.auth.id != '' && consultant = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && consultant = @request.auth.id",
      deleteRule: "@request.auth.id != '' && consultant = @request.auth.id",
      fields: [
        { name: 'organization_id', type: 'text' },
        {
          name: 'consultant',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'contact',
          type: 'relation',
          required: true,
          collectionId: contactsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'conversation',
          type: 'relation',
          required: true,
          collectionId: convId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'stage',
          type: 'select',
          required: true,
          values: [
            'novo',
            'qualificacao',
            'oportunidade',
            'reuniao',
            'proposta',
            'negociacao',
            'fechado',
            'perdido',
          ],
          maxSelect: 1,
        },
        { name: 'potential_value', type: 'number' },
        { name: 'product_interest', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['open', 'won', 'lost', 'stalled'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_opp_consultant ON opportunities (consultant)',
        'CREATE INDEX idx_opp_stage ON opportunities (stage)',
        'CREATE INDEX idx_opp_status ON opportunities (status)',
      ],
    })
    app.save(opportunities)
    const oppId = opportunities.id

    // 9. opportunity_events
    const opportunityEvents = new Collection({
      name: 'opportunity_events',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'opportunity',
          type: 'relation',
          required: true,
          collectionId: oppId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'type', type: 'text', required: true },
        { name: 'data', type: 'json' },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_opp_events_opp ON opportunity_events (opportunity)'],
    })
    app.save(opportunityEvents)

    // 10. ai_suggestions
    const aiSuggestions = new Collection({
      name: 'ai_suggestions',
      type: 'base',
      listRule: "@request.auth.id != '' && consultant = @request.auth.id",
      viewRule: "@request.auth.id != '' && consultant = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && consultant = @request.auth.id",
      deleteRule: "@request.auth.id != '' && consultant = @request.auth.id",
      fields: [
        { name: 'organization_id', type: 'text' },
        {
          name: 'consultant',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'conversation',
          type: 'relation',
          required: true,
          collectionId: convId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: [
            'discovery_question',
            'handle_objection',
            'explain_concept',
            'advance_to_meeting',
            'create_followup',
            'create_task',
            'wait_for_customer',
            'send_content',
            'request_document',
            'escalate_to_manager',
            'technical_validation',
            'close_opportunity',
            'reactivate_opportunity',
          ],
          maxSelect: 1,
        },
        {
          name: 'commercial_stage',
          type: 'select',
          required: true,
          values: [
            'novo',
            'qualificacao',
            'oportunidade',
            'reuniao',
            'proposta',
            'negociacao',
            'fechado',
            'perdido',
          ],
          maxSelect: 1,
        },
        { name: 'customer_intent', type: 'text' },
        { name: 'objections', type: 'json' },
        { name: 'purchase_signals', type: 'json' },
        { name: 'risk_signals', type: 'json' },
        { name: 'next_best_action', type: 'text', required: true },
        { name: 'follow_up_required', type: 'bool' },
        { name: 'follow_up_date', type: 'date' },
        { name: 'meeting_recommended', type: 'bool' },
        { name: 'technical_review_required', type: 'bool' },
        { name: 'suggested_response', type: 'json' },
        { name: 'confidence', type: 'number', required: true },
        { name: 'reasoning_summary', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pending', 'accepted', 'edited', 'ignored', 'deferred'],
          maxSelect: 1,
        },
        { name: 'feedback', type: 'text' },
        { name: 'suggestion_source', type: 'select', values: ['ai', 'manual'], maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ai_sugg_consultant ON ai_suggestions (consultant)',
        'CREATE INDEX idx_ai_sugg_conv ON ai_suggestions (conversation)',
        'CREATE INDEX idx_ai_sugg_status ON ai_suggestions (status)',
        'CREATE INDEX idx_ai_sugg_created ON ai_suggestions (created DESC)',
      ],
    })
    app.save(aiSuggestions)
    const aiSuggId = aiSuggestions.id

    // 11. followups
    const followups = new Collection({
      name: 'followups',
      type: 'base',
      listRule: "@request.auth.id != '' && consultant = @request.auth.id",
      viewRule: "@request.auth.id != '' && consultant = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && consultant = @request.auth.id",
      deleteRule: "@request.auth.id != '' && consultant = @request.auth.id",
      fields: [
        { name: 'organization_id', type: 'text' },
        {
          name: 'consultant',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'conversation',
          type: 'relation',
          required: true,
          collectionId: convId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'contact',
          type: 'relation',
          required: true,
          collectionId: contactsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'opportunity',
          type: 'relation',
          collectionId: oppId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'reason', type: 'text', required: true },
        { name: 'scheduled_date', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['scheduled', 'pending_approval', 'approved', 'sent', 'cancelled', 'rescheduled'],
          maxSelect: 1,
        },
        { name: 'suggested_text', type: 'text', required: true },
        { name: 'is_automatic', type: 'bool' },
        {
          name: 'source_ai_suggestion',
          type: 'relation',
          collectionId: aiSuggId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'sent_at', type: 'date' },
        { name: 'cancelled_reason', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_followups_consultant ON followups (consultant)',
        'CREATE INDEX idx_followups_status ON followups (status)',
        'CREATE INDEX idx_followups_sched ON followups (scheduled_date)',
      ],
    })
    app.save(followups)

    // 12. tasks
    const tasks = new Collection({
      name: 'tasks',
      type: 'base',
      listRule: "@request.auth.id != '' && consultant = @request.auth.id",
      viewRule: "@request.auth.id != '' && consultant = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && consultant = @request.auth.id",
      deleteRule: "@request.auth.id != '' && consultant = @request.auth.id",
      fields: [
        { name: 'organization_id', type: 'text' },
        {
          name: 'consultant',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'conversation',
          type: 'relation',
          collectionId: convId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'due_date', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['open', 'done', 'cancelled'],
          maxSelect: 1,
        },
        { name: 'source', type: 'select', values: ['manual', 'ai'], maxSelect: 1 },
        {
          name: 'source_ai_suggestion',
          type: 'relation',
          collectionId: aiSuggId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_tasks_consultant ON tasks (consultant)',
        'CREATE INDEX idx_tasks_status ON tasks (status)',
      ],
    })
    app.save(tasks)

    // 13. calendar_connections
    const calendarConnections = new Collection({
      name: 'calendar_connections',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'provider', type: 'text', required: true },
        { name: 'is_connected', type: 'bool' },
        { name: 'provider_account_email', type: 'text' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_cal_conn_user ON calendar_connections (user)'],
    })
    app.save(calendarConnections)
    const calConnId = calendarConnections.id

    // 14. calendar_events
    const calendarEvents = new Collection({
      name: 'calendar_events',
      type: 'base',
      listRule: "@request.auth.id != '' && consultant = @request.auth.id",
      viewRule: "@request.auth.id != '' && consultant = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && consultant = @request.auth.id",
      deleteRule: "@request.auth.id != '' && consultant = @request.auth.id",
      fields: [
        { name: 'organization_id', type: 'text' },
        {
          name: 'consultant',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'conversation',
          type: 'relation',
          collectionId: convId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'contact',
          type: 'relation',
          collectionId: contactsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'opportunity',
          type: 'relation',
          collectionId: oppId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'calendar_connection',
          type: 'relation',
          collectionId: calConnId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'provider_event_id', type: 'text' },
        { name: 'title', type: 'text', required: true },
        { name: 'date', type: 'date', required: true },
        { name: 'meeting_type', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['scheduled', 'done', 'cancelled'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_cal_events_consultant ON calendar_events (consultant)',
        'CREATE INDEX idx_cal_events_date ON calendar_events (date)',
      ],
    })
    app.save(calendarEvents)

    // 15. knowledge_documents
    const knowledgeDocs = new Collection({
      name: 'knowledge_documents',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'category', type: 'text' },
        { name: 'version', type: 'text' },
        { name: 'valid_until', type: 'date' },
        { name: 'responsible', type: 'text' },
        { name: 'published_at', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['approved', 'not_approved'],
          maxSelect: 1,
        },
        { name: 'content', type: 'text' },
        { name: 'content_embedding', type: 'vector', dimensions: 1536 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_kdocs_status ON knowledge_documents (status)'],
    })
    app.save(knowledgeDocs)

    // 16. integration_events
    const integrationEvents = new Collection({
      name: 'integration_events',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'type', type: 'text', required: true },
        { name: 'provider', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['received', 'processed', 'error'],
          maxSelect: 1,
        },
        { name: 'payload', type: 'json' },
        { name: 'error_message', type: 'text' },
        { name: 'idempotency_key', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_integ_events_status ON integration_events (status)',
        'CREATE INDEX idx_integ_events_type ON integration_events (type)',
      ],
    })
    app.save(integrationEvents)

    // 17. audit_logs
    const auditLogs = new Collection({
      name: 'audit_logs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user',
          type: 'relation',
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'action', type: 'text', required: true },
        { name: 'entity_type', type: 'text' },
        { name: 'entity_id', type: 'text' },
        { name: 'details', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_audit_user ON audit_logs (user)',
        'CREATE INDEX idx_audit_created ON audit_logs (created DESC)',
      ],
    })
    app.save(auditLogs)

    // 18. usage_metrics
    const usageMetrics = new Collection({
      name: 'usage_metrics',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user',
          type: 'relation',
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'metric', type: 'text', required: true },
        { name: 'value', type: 'number', required: true },
        { name: 'metadata', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_metrics_metric ON usage_metrics (metric)',
        'CREATE INDEX idx_metrics_created ON usage_metrics (created DESC)',
      ],
    })
    app.save(usageMetrics)
  },
  (app) => {
    const names = [
      'usage_metrics',
      'audit_logs',
      'integration_events',
      'knowledge_documents',
      'calendar_events',
      'calendar_connections',
      'tasks',
      'followups',
      'ai_suggestions',
      'opportunity_events',
      'opportunities',
      'messages',
      'conversation_labels',
      'conversations',
      'contacts',
      'commercial_labels',
      'whatsapp_instances',
      'user_profiles',
    ]
    for (const name of names) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
