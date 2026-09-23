// Ingest message hook (idempotent, logs to integration_events, triggers copilot analysis)
routerAdd(
  'POST',
  '/backend/v1/messages/ingest',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const conversationId = body.conversation_id
      const contactId = body.contact_id
      const content = (body.content || '').trim()
      const direction = body.direction || 'inbound'
      const providerEventId = body.provider_event_id || 'evt_' + $security.randomString(16)
      const messageType = body.message_type || 'text'
      const metadata = body.metadata || {}

      if (!conversationId || !contactId || !content) {
        return e.badRequestError('conversation_id, contact_id, and content are required')
      }

      // Mandatory idempotency: if provider_event_id exists, return existing
      try {
        const existing = $app.findFirstRecordByData(
          'messages',
          'provider_event_id',
          providerEventId,
        )
        return e.json(200, {
          ok: true,
          idempotent: true,
          message: existing,
        })
      } catch (_) {
        // not found, proceed
      }

      // Ingest into messages
      const messagesCol = $app.findCollectionByNameOrId('messages')
      const msgRecord = new Record(messagesCol)
      msgRecord.set('consultant', userId)
      msgRecord.set('conversation', conversationId)
      msgRecord.set('contact', contactId)
      msgRecord.set('direction', direction)
      msgRecord.set('message_type', messageType)
      msgRecord.set('content', content)
      msgRecord.set('timestamp', new Date().toISOString())
      msgRecord.set('provider_event_id', providerEventId)
      msgRecord.set('metadata', metadata)
      $app.save(msgRecord)

      // Update conversation last_interaction_at
      try {
        const convRecord = $app.findCollectionByNameOrId('conversations')
        const conv = $app.findFirstRecordByData('conversations', 'id', conversationId)
        conv.set('last_interaction_at', new Date().toISOString())
        $app.save(conv)
      } catch (_) {}

      // Log to integration_events
      try {
        const integCol = $app.findCollectionByNameOrId('integration_events')
        const integRec = new Record(integCol)
        integRec.set('type', 'message_ingested')
        integRec.set('provider', 'whatsapp_adapter')
        integRec.set('status', 'processed')
        integRec.set('idempotency_key', providerEventId)
        integRec.set('payload', {
          message_id: msgRecord.id,
          direction: direction,
          conversation_id: conversationId,
          content_preview: content.slice(0, 100),
        })
        $app.save(integRec)
      } catch (_) {}

      return e.json(200, {
        ok: true,
        idempotent: false,
        message: msgRecord,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Failed to ingest message' })
    }
  },
  $apis.requireAuth(),
)
