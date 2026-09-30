// Webhook endpoint called by Evolution API installed on the user's VPS
// URL for Evolution Webhook settings:
// POST https://<BACKEND_URL>/backend/v1/webhook/evolution
// Events to configure: MESSAGES_UPSERT, CONNECTION_UPDATE
routerAdd('POST', '/backend/v1/webhook/evolution', (e) => {
  try {
    const rawBody = e.requestInfo().body || {}
    const eventType = rawBody.event || rawBody.type || 'messages.upsert'
    const instance = rawBody.instance || ''

    // Optional security header check if apikey sent in header
    const headerApiKey = e.request.header.get('apikey') || e.request.header.get('x-api-key') || ''
    const systemKey = $os.getenv('EVOLUTION_API_KEY') || ''

    // 1. Handle CONNECTION_UPDATE
    if (eventType.includes('connection') || eventType === 'CONNECTION_UPDATE') {
      const state = (rawBody.data?.state || rawBody.state || '').toLowerCase()
      try {
        const instances = $app.findRecordsByFilter(
          'whatsapp_instances',
          'instance_name = "' + instance + '" || provider_instance_id = "' + instance + '"',
          '-created',
          1,
          0,
        )
        if (instances.length > 0) {
          const wa = instances[0]
          const newStatus =
            state === 'open' ? 'connected' : state === 'close' ? 'disconnected' : 'connecting'
          wa.set('status', newStatus)
          $app.save(wa)

          // Update user profile
          const userId = wa.getString('user')
          if (userId) {
            try {
              const prof = $app.findFirstRecordByData('user_profiles', 'user', userId)
              prof.set('whatsapp_connected', newStatus === 'connected')
              $app.save(prof)
            } catch (_) {}
          }
        }
      } catch (_) {}

      return e.json(200, { ok: true, handled: 'connection_update' })
    }

    // 2. Handle MESSAGES_UPSERT
    const data = rawBody.data || rawBody
    const messageObj = data.message || (data.messages && data.messages[0]) || null

    if (!messageObj) {
      return e.json(200, { ok: true, skipped: 'no message payload' })
    }

    const key = messageObj.key || {}
    const fromMe = Boolean(key.fromMe)
    const remoteJid = key.remoteJid || ''

    // Skip status broadcast and groups if desired, or handle standard contacts
    if (remoteJid.includes('@broadcast') || remoteJid.includes('@g.us')) {
      return e.json(200, { ok: true, skipped: 'broadcast or group ignored' })
    }

    // Extract phone number from remoteJid (e.g. 5541999998888@s.whatsapp.net -> +55 41 99999-8888)
    const rawPhone = remoteJid.split('@')[0] || ''
    if (!rawPhone) {
      return e.json(200, { ok: true, skipped: 'invalid remoteJid' })
    }

    // Extract content
    const msgContent =
      messageObj.message?.conversation ||
      messageObj.message?.extendedTextMessage?.text ||
      messageObj.message?.imageMessage?.caption ||
      messageObj.message?.documentMessage?.caption ||
      messageObj.message?.buttonsResponseMessage?.selectedDisplayText ||
      messageObj.message?.templateButtonReplyMessage?.selectedId ||
      '[Mídia/Mensagem sem texto]'

    const providerEventId = key.id || 'evo_' + $security.randomString(16)
    const pushName = data.pushName || messageObj.pushName || 'Contato WhatsApp'

    // Idempotency check: if provider_event_id already exists in messages, return ok
    try {
      const existing = $app.findFirstRecordByData('messages', 'provider_event_id', providerEventId)
      return e.json(200, { ok: true, idempotent: true, id: existing.id })
    } catch (_) {}

    // Find consultant user associated with instance or organization
    let consultantId = ''
    let instanceId = ''
    try {
      const instances = $app.findRecordsByFilter(
        'whatsapp_instances',
        'instance_name = "' + instance + '" || provider_instance_id = "' + instance + '"',
        '-created',
        1,
        0,
      )
      if (instances.length > 0) {
        consultantId = instances[0].getString('user')
        instanceId = instances[0].id
      }
    } catch (_) {}

    if (!consultantId) {
      // Fallback to first active user
      try {
        const firstUser = $app.findRecordsByFilter('users', 'id != ""', '-created', 1, 0)
        if (firstUser.length > 0) consultantId = firstUser[0].id
      } catch (_) {}
    }

    // Find or create contact
    let contactRecord = null
    try {
      const contacts = $app.findRecordsByFilter(
        'contacts',
        'phone ~ "' + rawPhone.slice(-8) + '"',
        '-created',
        1,
        0,
      )
      if (contacts.length > 0) {
        contactRecord = contacts[0]
      }
    } catch (_) {}

    if (!contactRecord) {
      const contactsCol = $app.findCollectionByNameOrId('contacts')
      contactRecord = new Record(contactsCol)
      contactRecord.set('consultant', consultantId)
      if (instanceId) contactRecord.set('whatsapp_instance', instanceId)
      contactRecord.set('name', pushName)
      contactRecord.set('phone', '+' + rawPhone)
      contactRecord.set('category', 'lead')
      contactRecord.set('organization_id', 'org_ademicon_default')
      $app.save(contactRecord)
    }

    // Find or create conversation
    let conversationRecord = null
    try {
      const convs = $app.findRecordsByFilter(
        'conversations',
        'contact = "' + contactRecord.id + '"',
        '-created',
        1,
        0,
      )
      if (convs.length > 0) {
        conversationRecord = convs[0]
      }
    } catch (_) {}

    if (!conversationRecord) {
      const convCol = $app.findCollectionByNameOrId('conversations')
      conversationRecord = new Record(convCol)
      conversationRecord.set('consultant', consultantId)
      conversationRecord.set('contact', contactRecord.id)
      if (instanceId) conversationRecord.set('whatsapp_instance', instanceId)
      conversationRecord.set('commercial_stage', 'novo')
      conversationRecord.set('temperature', 'morna')
      conversationRecord.set('organization_id', 'org_ademicon_default')
      conversationRecord.set('last_interaction_at', new Date().toISOString())
      $app.save(conversationRecord)
    } else {
      conversationRecord.set('last_interaction_at', new Date().toISOString())
      $app.save(conversationRecord)
    }

    // Insert message
    const messagesCol = $app.findCollectionByNameOrId('messages')
    const msg = new Record(messagesCol)
    msg.set('consultant', consultantId)
    msg.set('conversation', conversationRecord.id)
    msg.set('contact', contactRecord.id)
    if (instanceId) msg.set('whatsapp_instance', instanceId)
    msg.set('direction', fromMe ? 'outbound' : 'inbound')
    msg.set('message_type', 'text')
    msg.set('content', msgContent)
    msg.set('timestamp', new Date().toISOString())
    msg.set('provider_event_id', providerEventId)
    msg.set('metadata', {
      evolution_instance: instance,
      remoteJid: remoteJid,
      pushName: pushName,
      fromMe: fromMe,
    })
    $app.save(msg)

    // If inbound, check if this is a reply to an ongoing broadcast campaign
    if (!fromMe) {
      try {
        const recipients = $app.findRecordsByFilter(
          'broadcast_recipients',
          'contact = "' +
            contactRecord.id +
            '" && (status = "sent" || status = "delivered" || status = "read")',
          '-created',
          1,
          0,
        )
        if (recipients.length > 0) {
          const rec = recipients[0]
          rec.set('status', 'read')
          rec.set('replied_at', new Date().toISOString())
          $app.save(rec)

          const campId = rec.getString('campaign')
          if (campId) {
            const camp = $app.findFirstRecordByData('broadcast_campaigns', 'id', campId)
            const replied = camp.getInt('replied_count') || 0
            camp.set('replied_count', replied + 1)
            $app.save(camp)
          }
        }
      } catch (_) {}

      // Trigger AI analysis if inbound
      try {
        $http.send({
          url:
            ($os.getenv('PB_INSTANCE_URL') || 'http://127.0.0.1:8090') +
            '/backend/v1/copilot/analyze',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: $os.getenv('PB_SUPERUSER_TOKEN') || '',
          },
          body: JSON.stringify({ conversation_id: conversationRecord.id }),
          timeout: 5,
        })
      } catch (_) {}
    }

    return e.json(200, {
      ok: true,
      message_id: msg.id,
      conversation_id: conversationRecord.id,
      contact_id: contactRecord.id,
    })
  } catch (err) {
    return e.json(500, { error: err.message || 'Erro ao processar webhook' })
  }
})
