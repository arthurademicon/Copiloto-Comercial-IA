/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('users')
    const usersId = usersCollection.id
    const contactsCollection = app.findCollectionByNameOrId('contacts')
    const contactsId = contactsCollection.id

    // 1. integration_configs (for Evolution API and other tenant-level integration settings)
    const integrationConfigs = new Collection({
      name: 'integration_configs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'organization_id', type: 'text', required: true },
        { name: 'provider', type: 'text', required: true }, // 'evolution_api', 'openai', etc.
        { name: 'base_url', type: 'text' },
        { name: 'api_key', type: 'text' }, // masked when returned via custom hook or admin only
        { name: 'instance_name', type: 'text' },
        { name: 'is_active', type: 'bool' },
        { name: 'settings', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_integ_cfg_org_prov ON integration_configs (organization_id, provider)',
      ],
    })
    app.save(integrationConfigs)

    // 2. ai_configs (pluggable AI layer configuration per organization)
    const aiConfigs = new Collection({
      name: 'ai_configs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'organization_id', type: 'text', required: true },
        {
          name: 'provider',
          type: 'select',
          required: true,
          values: ['skip_agent', 'openai', 'anthropic', 'custom_openrouter'],
          maxSelect: 1,
        },
        { name: 'model', type: 'text' }, // e.g. 'commercial-copilot', 'gpt-4o', 'claude-3-5-sonnet'
        { name: 'temperature', type: 'number' },
        { name: 'api_key', type: 'text' }, // optional custom key if external provider
        { name: 'custom_endpoint', type: 'text' },
        { name: 'system_prompt_override', type: 'text' },
        { name: 'is_active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_ai_cfg_org ON ai_configs (organization_id)'],
    })
    app.save(aiConfigs)

    // 3. broadcast_campaigns (WhatsApp bulk/broadcast campaigns)
    const broadcastCampaigns = new Collection({
      name: 'broadcast_campaigns',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'organization_id', type: 'text', required: true },
        {
          name: 'consultant',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'message_template', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled'],
          maxSelect: 1,
        },
        { name: 'audience_filter', type: 'json' },
        { name: 'total_recipients', type: 'number' },
        { name: 'sent_count', type: 'number' },
        { name: 'delivered_count', type: 'number' },
        { name: 'read_count', type: 'number' },
        { name: 'error_count', type: 'number' },
        { name: 'replied_count', type: 'number' },
        { name: 'scheduled_at', type: 'date' },
        { name: 'min_interval_seconds', type: 'number' }, // throttling anti-ban (default 15)
        { name: 'max_interval_seconds', type: 'number' }, // jitter anti-ban (default 30)
        { name: 'requires_manual_approval', type: 'bool' }, // autonomy mode 1 flag
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_campaigns_org ON broadcast_campaigns (organization_id)',
        'CREATE INDEX idx_campaigns_status ON broadcast_campaigns (status)',
      ],
    })
    app.save(broadcastCampaigns)
    const broadcastCampaignsId = broadcastCampaigns.id

    // 4. broadcast_recipients (individual messages per campaign)
    const broadcastRecipients = new Collection({
      name: 'broadcast_recipients',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'campaign',
          type: 'relation',
          required: true,
          collectionId: broadcastCampaignsId,
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
        { name: 'recipient_phone', type: 'text', required: true },
        { name: 'recipient_name', type: 'text' },
        { name: 'rendered_message', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: [
            'pending',
            'waiting_approval',
            'approved',
            'sending',
            'sent',
            'delivered',
            'read',
            'error',
            'cancelled',
          ],
          maxSelect: 1,
        },
        { name: 'provider_event_id', type: 'text' },
        { name: 'error_details', type: 'text' },
        { name: 'sent_at', type: 'date' },
        { name: 'delivered_at', type: 'date' },
        { name: 'read_at', type: 'date' },
        { name: 'replied_at', type: 'date' },
        { name: 'retry_count', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_recipients_campaign ON broadcast_recipients (campaign)',
        'CREATE INDEX idx_recipients_status ON broadcast_recipients (status)',
      ],
    })
    app.save(broadcastRecipients)
  },
  (app) => {
    try {
      const r = app.findCollectionByNameOrId('broadcast_recipients')
      app.delete(r)
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId('broadcast_campaigns')
      app.delete(c)
    } catch (_) {}
    try {
      const a = app.findCollectionByNameOrId('ai_configs')
      app.delete(a)
    } catch (_) {}
    try {
      const i = app.findCollectionByNameOrId('integration_configs')
      app.delete(i)
    } catch (_) {}
  },
)
