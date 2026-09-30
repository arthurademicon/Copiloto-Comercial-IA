// Endpoint to send a WhatsApp message via Evolution API or fallback to internal demo
routerAdd(
  'POST',
  '/backend/v1/whatsapp/send',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const conversationId = body.conversation_id
      const contactId = body.contact_id
      const content = (body.content || '').trim()
      const metadata = body.metadata || {}

      if (!content) return e.badRequestError('content is required')
      if (!conversationId && !contactId)
        return e.badRequestError('conversation_id or contact_id is required')

      // Resolve contact and phone
      let contactRecord = null
      let conversationRecord = null

      if (contactId) {
        try {
          contactRecord = $app.findFirstRecordByData('contacts', 'id', contactId)
        } catch (_) {}
      }

      if (conversationId) {
        try {
          conversationRecord = $app.findFirstRecordByData('conversations', 'id', conversationId)
          if (!contactRecord && conversationRecord.getString('contact')) {
            contactRecord = $app.findFirstRecordByData(
              'contacts',
              'id',
              conversationRecord.getString('contact'),
            )
          }
        } catch (_) {}
      }

      const phone = (contactRecord ? contactRecord.getString('phone') : '') || body.phone || ''
      const cleanPhone = phone.replace(/\D/g, '')

      // Check Evolution config
      let baseUrl = $os.getenv('EVOLUTION_API_URL') || ''
      let apiKey = $os.getenv('EVOLUTION_API_KEY') || ''
      let instanceName = $os.getenv('EVOLUTION_INSTANCE_NAME') || 'copiloto-ademicon'

      try {
        const profile = $app.findFirstRecordByData('user_profiles', 'user', userId)
        const orgId = profile.getString('organization_id') || 'org_ademicon_default'
        const configs = $app.findRecordsByFilter(
          'integration_configs',
          'organization_id = "' + orgId + '" && provider = "evolution_api"',
          '-created',
          1,
          0,
        )
        if (configs.length > 0) {
          const cfg = configs[0]
          if (cfg.getString('base_url')) baseUrl = cfg.getString('base_url')
          if (cfg.getString('api_key')) apiKey = cfg.getString('api_key')
          if (cfg.getString('instance_name')) instanceName = cfg.getString('instance_name')
        }
      } catch (_) {}

      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)

      const isRealProvider = Boolean(baseUrl && apiKey && cleanPhone)
      let providerEventId = 'evo_out_' + $security.randomString(16)
      let sendSuccess = true
      let providerResponse = null

      if (isRealProvider) {
        try {
          const res = $http.send({
            url: baseUrl + '/message/sendText/' + encodeURIComponent(instanceName),
            method: 'POST',
            headers: {
              apikey: apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              number: cleanPhone,
              options: {
                delay: 1200,
                presence: 'composing',
                linkPreview: true,
              },
              textMessage: {
                text: content,
              },
            }),
            timeout: 15,
          })

          if (res.statusCode >= 200 && res.statusCode < 300) {
            providerResponse = res.json || {}
            providerEventId = providerResponse?.key?.id || providerResponse?.id || providerEventId
          } else {
            sendSuccess = false
            return e.json(res.statusCode, {
              error: 'Evolution API retornou erro HTTP ' + res.statusCode,
              details: res.json || res.raw,
            })
          }
        } catch (callErr) {
          return e.json(502, { error: 'Falha ao conectar na Evolution API: ' + callErr.message })
        }
      } else {
        // Demo mode
        providerEventId = 'demo_out_' + $security.randomString(16)
      }

      // Persist in messages
      const messagesCol = $app.findCollectionByNameOrId('messages')
      const msg = new Record(messagesCol)
      msg.set('consultant', userId)
      if (conversationRecord) msg.set('conversation', conversationRecord.id)
      if (contactRecord) msg.set('contact', contactRecord.id)
      msg.set('direction', 'outbound')
      msg.set('message_type', 'text')
      msg.set('content', content)
      msg.set('timestamp', new Date().toISOString())
      msg.set('provider_event_id', providerEventId)
      msg.set('metadata', {
        ...metadata,
        provider: isRealProvider ? 'evolution_api' : 'demo',
        instance: instanceName,
      })
      $app.save(msg)

      // Update conversation last_interaction_at
      if (conversationRecord) {
        conversationRecord.set('last_interaction_at', new Date().toISOString())
        $app.save(conversationRecord)
      }

      // Audit log
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('user', userId)
        audit.set('action', 'whatsapp_message_sent')
        audit.set('entity_type', 'messages')
        audit.set('entity_id', msg.id)
        audit.set('details', {
          is_real_provider: isRealProvider,
          phone: cleanPhone ? '***' + cleanPhone.slice(-4) : '',
          provider_event_id: providerEventId,
        })
        $app.save(audit)
      } catch (_) {}

      return e.json(200, {
        ok: true,
        message: msg,
        is_demo: !isRealProvider,
        provider_event_id: providerEventId,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao enviar mensagem WhatsApp' })
    }
  },
  $apis.requireAuth(),
)
