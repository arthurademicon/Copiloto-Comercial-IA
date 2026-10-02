/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('users')
    const usersId = usersCollection.id
    const contactsCollection = app.findCollectionByNameOrId('contacts')
    const contactsId = contactsCollection.id
    const broadcastCampaignsCollection = app.findCollectionByNameOrId('broadcast_campaigns')
    const broadcastCampaignsId = broadcastCampaignsCollection.id

    // 1. prospect_lists (Listas de prospecção criadas pelos consultores)
    const prospectLists = new Collection({
      name: 'prospect_lists',
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
        { name: 'niche', type: 'text', required: true },
        { name: 'location', type: 'text', required: true },
        { name: 'target_volume', type: 'number', required: true },
        { name: 'daily_limit', type: 'number' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['collecting', 'ready', 'dispatching', 'paused', 'completed', 'failed'],
          maxSelect: 1,
        },
        { name: 'total_collected', type: 'number' },
        { name: 'valid_phone_count', type: 'number' },
        { name: 'invalid_phone_count', type: 'number' },
        { name: 'duplicates_count', type: 'number' },
        { name: 'dispatched_count', type: 'number' },
        { name: 'replied_count', type: 'number' },
        { name: 'is_demo', type: 'bool' },
        { name: 'message_template', type: 'text' },
        {
          name: 'campaign',
          type: 'relation',
          collectionId: broadcastCampaignsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_prospect_lists_org ON prospect_lists (organization_id)',
        'CREATE INDEX idx_prospect_lists_consultant ON prospect_lists (consultant)',
        'CREATE INDEX idx_prospect_lists_status ON prospect_lists (status)',
      ],
    })
    app.save(prospectLists)
    const prospectListsId = prospectLists.id

    // 2. prospects (Contatos individuais prospectados via Google Places)
    const prospects = new Collection({
      name: 'prospects',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'organization_id', type: 'text', required: true },
        {
          name: 'list',
          type: 'relation',
          required: true,
          collectionId: prospectListsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'consultant',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'place_id', type: 'text' },
        { name: 'establishment_name', type: 'text', required: true },
        { name: 'raw_phone', type: 'text' },
        { name: 'formatted_phone', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'website', type: 'text' },
        { name: 'google_rating', type: 'number' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: [
            'pendente',
            'na_fila',
            'enviado',
            'respondido',
            'falha',
            'sem_whatsapp_valido',
            'duplicado',
          ],
          maxSelect: 1,
        },
        { name: 'rendered_message', type: 'text' },
        {
          name: 'contact',
          type: 'relation',
          collectionId: contactsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'error_details', type: 'text' },
        { name: 'dispatched_at', type: 'date' },
        { name: 'replied_at', type: 'date' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_prospects_list ON prospects (list)',
        'CREATE INDEX idx_prospects_phone ON prospects (formatted_phone)',
        'CREATE INDEX idx_prospects_status ON prospects (status)',
      ],
    })
    app.save(prospects)
  },
  (app) => {
    try {
      const p = app.findCollectionByNameOrId('prospects')
      app.delete(p)
    } catch (_) {}
    try {
      const l = app.findCollectionByNameOrId('prospect_lists')
      app.delete(l)
    } catch (_) {}
  },
)
