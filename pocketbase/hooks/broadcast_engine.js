// Broadcast engine hook: Campaign creation, audience evaluation, approval flow, and throttled batch processing

// 1. Create Broadcast Campaign
routerAdd(
  'POST',
  '/backend/v1/broadcasts/create',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const profile = $app.findFirstRecordByData('user_profiles', 'user', userId)
      const orgId = profile.getString('organization_id') || 'org_ademicon_default'
      const autonomyMode = profile.getString('autonomy_mode') || 'copilot'

      const body = e.requestInfo().body || {}
      const title = (body.title || '').trim()
      const messageTemplate = (body.message_template || '').trim()
      const audienceFilter = body.audience_filter || {}
      const scheduledAt = body.scheduled_at || null
      const minInterval = body.min_interval_seconds || 15
      const maxInterval = body.max_interval_seconds || 30

      if (!title || !messageTemplate) {
        return e.badRequestError('Título e modelo da mensagem são obrigatórios.')
      }

      // Autonomy rule: in 'copilot' mode (mode 1), messages require manual approval before sending
      const requiresApproval = autonomyMode === 'copilot' || Boolean(body.requires_manual_approval)

      // Query audience from contacts
      let contactFilter = 'consultant = "' + userId + '"'
      if (audienceFilter.category && audienceFilter.category !== 'all') {
        contactFilter += ' && category = "' + audienceFilter.category + '"'
      }

      let audienceContacts = []
      try {
        audienceContacts = $app.findRecordsByFilter('contacts', contactFilter, '-created', 100, 0)
      } catch (_) {}

      // If specific contact IDs provided
      if (Array.isArray(audienceFilter.contact_ids) && audienceFilter.contact_ids.length > 0) {
        const idList = audienceFilter.contact_ids
        audienceContacts = audienceContacts.filter(function (c) {
          return idList.indexOf(c.id) !== -1
        })
      }

      const totalRecipients = audienceContacts.length

      // Create campaign record
      const campCol = $app.findCollectionByNameOrId('broadcast_campaigns')
      const camp = new Record(campCol)
      camp.set('organization_id', orgId)
      camp.set('consultant', userId)
      camp.set('title', title)
      camp.set('message_template', messageTemplate)
      camp.set('status', scheduledAt ? 'scheduled' : requiresApproval ? 'draft' : 'scheduled')
      camp.set('audience_filter', audienceFilter)
      camp.set('total_recipients', totalRecipients)
      camp.set('sent_count', 0)
      camp.set('delivered_count', 0)
      camp.set('read_count', 0)
      camp.set('error_count', 0)
      camp.set('replied_count', 0)
      if (scheduledAt) camp.set('scheduled_at', scheduledAt)
      camp.set('min_interval_seconds', minInterval)
      camp.set('max_interval_seconds', maxInterval)
      camp.set('requires_manual_approval', requiresApproval)
      $app.save(camp)

      // Generate recipients
      const recCol = $app.findCollectionByNameOrId('broadcast_recipients')
      for (let i = 0; i < audienceContacts.length; i++) {
        const contact = audienceContacts[i]
        const cName = contact.getString('name') || 'Cliente'
        const cPhone = contact.getString('phone') || ''

        // Simple template variable replacement: {{nome}}, {{primeiro_nome}}
        const firstName = cName.split(' ')[0] || cName
        let rendered = messageTemplate.replace(/\{\{\s*nome\s*\}\}/gi, cName)
        rendered = rendered.replace(/\{\{\s*primeiro_nome\s*\}\}/gi, firstName)

        const rec = new Record(recCol)
        rec.set('campaign', camp.id)
        rec.set('contact', contact.id)
        rec.set('recipient_phone', cPhone)
        rec.set('recipient_name', cName)
        rec.set('rendered_message', rendered)
        rec.set('status', requiresApproval ? 'waiting_approval' : 'pending')
        rec.set('retry_count', 0)
        $app.save(rec)
      }

      // Audit log
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('user', userId)
        audit.set('action', 'broadcast_campaign_created')
        audit.set('entity_type', 'broadcast_campaigns')
        audit.set('entity_id', camp.id)
        audit.set('details', {
          title: title,
          total_recipients: totalRecipients,
          requires_approval: requiresApproval,
        })
        $app.save(audit)
      } catch (_) {}

      return e.json(200, {
        ok: true,
        campaign: camp,
        total_recipients: totalRecipients,
        requires_manual_approval: requiresApproval,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao criar campanha de disparo' })
    }
  },
  $apis.requireAuth(),
)

// 2. Approve one or all recipients in campaign (Mode 1 human approval)
routerAdd(
  'POST',
  '/backend/v1/broadcasts/approve',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const recipientId = body.recipient_id
      const campaignId = body.campaign_id
      const approveAll = Boolean(body.approve_all)

      if (!recipientId && !campaignId) {
        return e.badRequestError('recipient_id ou campaign_id é obrigatório')
      }

      if (approveAll && campaignId) {
        const waiting = $app.findRecordsByFilter(
          'broadcast_recipients',
          'campaign = "' + campaignId + '" && status = "waiting_approval"',
          'created',
          200,
          0,
        )
        for (let i = 0; i < waiting.length; i++) {
          waiting[i].set('status', 'approved')
          $app.save(waiting[i])
        }
        return e.json(200, { ok: true, approved_count: waiting.length })
      } else if (recipientId) {
        const rec = $app.findFirstRecordByData('broadcast_recipients', 'id', recipientId)
        rec.set('status', 'approved')
        $app.save(rec)
        return e.json(200, { ok: true, approved_recipient: rec.id })
      }

      return e.badRequestError('Ação inválida')
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao aprovar disparo' })
    }
  },
  $apis.requireAuth(),
)

// 3. Process next batch for campaign (throttled sending via Evolution or Demo)
routerAdd(
  'POST',
  '/backend/v1/broadcasts/process-next',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const campaignId = body.campaign_id
      if (!campaignId) return e.badRequestError('campaign_id é obrigatório')

      const camp = $app.findFirstRecordByData('broadcast_campaigns', 'id', campaignId)
      const campStatus = camp.getString('status')
      if (campStatus === 'paused' || campStatus === 'cancelled' || campStatus === 'completed') {
        return e.json(200, { ok: false, message: 'Campanha está ' + campStatus })
      }

      // Mark running
      if (campStatus !== 'running') {
        camp.set('status', 'running')
        $app.save(camp)
      }

      // Resolve evolution settings
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
      const isRealProvider = Boolean(baseUrl && apiKey)

      // Find next batch of eligible recipients: status = 'approved' OR status = 'pending' (if approval not required)
      const allowedStatus = camp.getBool('requires_manual_approval')
        ? 'status = "approved"'
        : '(status = "approved" || status = "pending")'

      const batch = $app.findRecordsByFilter(
        'broadcast_recipients',
        'campaign = "' + campaignId + '" && ' + allowedStatus,
        'created',
        3, // Process up to 3 per call with individual throttling jitter
        0,
      )

      if (batch.length === 0) {
        // Check if there are still pending or waiting approval items
        const remaining = $app.findRecordsByFilter(
          'broadcast_recipients',
          'campaign = "' +
            campaignId +
            '" && (status = "pending" || status = "waiting_approval" || status = "sending")',
          'created',
          1,
          0,
        )
        if (remaining.length === 0) {
          camp.set('status', 'completed')
          $app.save(camp)
          return e.json(200, { ok: true, completed: true, message: 'Campanha finalizada!' })
        }
        return e.json(200, {
          ok: true,
          waiting_approval: true,
          message: 'Aguardando aprovação de mensagens restantes.',
        })
      }

      let processedCount = 0
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i]
        const phone = item.getString('recipient_phone')
        const cleanPhone = phone.replace(/\D/g, '')
        const text = item.getString('rendered_message')
        let sendOk = false
        let errorMsg = ''
        let evtId = 'bcast_' + $security.randomString(16)

        if (isRealProvider && cleanPhone) {
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
                textMessage: { text: text },
                options: { delay: 1500 },
              }),
              timeout: 10,
            })
            if (res.statusCode >= 200 && res.statusCode < 300) {
              sendOk = true
              evtId = res.json?.key?.id || evtId
            } else {
              errorMsg = 'HTTP ' + res.statusCode + ': ' + (res.json?.message || 'Falha no envio')
            }
          } catch (callErr) {
            errorMsg = callErr.message || 'Erro de conexão com VPS'
          }
        } else {
          // Demo simulation
          sendOk = true
          evtId = 'demo_bcast_' + $security.randomString(14)
        }

        if (sendOk) {
          item.set('status', 'sent')
          item.set('sent_at', new Date().toISOString())
          item.set('provider_event_id', evtId)
          $app.save(item)

          // Also register in messages table so it appears in conversation
          try {
            const contactId = item.getString('contact')
            const convs = $app.findRecordsByFilter(
              'conversations',
              'contact = "' + contactId + '"',
              '-created',
              1,
              0,
            )
            let convId = ''
            if (convs.length > 0) {
              convId = convs[0].id
              convs[0].set('last_interaction_at', new Date().toISOString())
              $app.save(convs[0])
            }
            const msgCol = $app.findCollectionByNameOrId('messages')
            const mRec = new Record(msgCol)
            mRec.set('consultant', userId)
            if (convId) mRec.set('conversation', convId)
            mRec.set('contact', contactId)
            mRec.set('direction', 'outbound')
            mRec.set('message_type', 'text')
            mRec.set('content', text)
            mRec.set('timestamp', new Date().toISOString())
            mRec.set('provider_event_id', evtId)
            mRec.set('metadata', { campaign_id: campaignId, type: 'broadcast' })
            $app.save(mRec)
          } catch (_) {}

          // Increment sent count
          const currentSent = camp.getInt('sent_count') || 0
          camp.set('sent_count', currentSent + 1)
        } else {
          const retries = (item.getInt('retry_count') || 0) + 1
          item.set('retry_count', retries)
          item.set('status', retries >= 3 ? 'error' : 'approved')
          item.set('error_details', errorMsg)
          $app.save(item)

          if (retries >= 3) {
            const currentErr = camp.getInt('error_count') || 0
            camp.set('error_count', currentErr + 1)
          }
        }
        $app.save(camp)
        processedCount++
      }

      return e.json(200, {
        ok: true,
        processed: processedCount,
        campaign_status: camp.getString('status'),
        sent_count: camp.getInt('sent_count'),
        error_count: camp.getInt('error_count'),
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao processar lote de disparos' })
    }
  },
  $apis.requireAuth(),
)

// 4. Update campaign status (pause/resume/cancel)
routerAdd(
  'POST',
  '/backend/v1/broadcasts/status',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const campaignId = body.campaign_id
      const newStatus = body.status // 'paused', 'running', 'cancelled'

      if (!campaignId || !newStatus)
        return e.badRequestError('campaign_id e status são obrigatórios')

      const camp = $app.findFirstRecordByData('broadcast_campaigns', 'id', campaignId)
      camp.set('status', newStatus)
      $app.save(camp)

      return e.json(200, { ok: true, status: newStatus })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao atualizar status da campanha' })
    }
  },
  $apis.requireAuth(),
)
