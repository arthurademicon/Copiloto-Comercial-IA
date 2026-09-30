// Hook to get integration status without exposing raw secrets to client
routerAdd(
  'GET',
  '/backend/v1/integrations/evolution/status',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      let baseUrl = $os.getenv('EVOLUTION_API_URL') || ''
      let apiKey = $os.getenv('EVOLUTION_API_KEY') || ''
      let instanceName = $os.getenv('EVOLUTION_INSTANCE_NAME') || 'copiloto-ademicon'

      // Check DB config overrides if present
      let hasCustomConfig = false
      let dbInstanceRecord = null
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
          hasCustomConfig = true
        }
      } catch (_) {}

      // Clean baseUrl
      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1)
      }

      const isConfigured = Boolean(baseUrl && apiKey)

      // Mask API key: ex: "••••••••" or "ab12••••89"
      let maskedKey = ''
      if (apiKey) {
        if (apiKey.length > 8) {
          maskedKey = apiKey.slice(0, 4) + '••••••••' + apiKey.slice(-4)
        } else {
          maskedKey = '••••••••'
        }
      }

      // Check live status with Evolution if configured
      let liveStatus = 'disconnected'
      let instanceData = null

      if (isConfigured) {
        try {
          const res = $http.send({
            url: baseUrl + '/instance/connectionState/' + encodeURIComponent(instanceName),
            method: 'GET',
            headers: {
              apikey: apiKey,
              'Content-Type': 'application/json',
            },
            timeout: 5,
          })

          if (res.statusCode >= 200 && res.statusCode < 300) {
            const body = res.json || {}
            // Evolution returns state: "open" (connected), "connecting", "close" (disconnected)
            const st = (body.instance?.state || body.state || '').toLowerCase()
            if (st === 'open') {
              liveStatus = 'connected'
            } else if (st === 'connecting') {
              liveStatus = 'connecting'
            } else {
              liveStatus = 'disconnected'
            }
            instanceData = body
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            liveStatus = 'error'
          } else {
            liveStatus = 'disconnected'
          }
        } catch (fetchErr) {
          // If instance is not created yet or host unreachable
          liveStatus = 'disconnected'
        }
      }

      return e.json(200, {
        is_configured: isConfigured,
        is_demo: !isConfigured,
        base_url: baseUrl || '',
        instance_name: instanceName,
        api_key_masked: maskedKey,
        has_api_key: Boolean(apiKey),
        live_status: liveStatus,
        instance_data: instanceData,
        source: hasCustomConfig ? 'database' : baseUrl ? 'env' : 'demo',
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao consultar status da Evolution' })
    }
  },
  $apis.requireAuth(),
)

// Hook to save integration settings (masking key, tenant-scoped)
routerAdd(
  'POST',
  '/backend/v1/integrations/evolution/config',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      let baseUrl = (body.base_url || '').trim()
      const apiKey = (body.api_key || '').trim()
      const instanceName = (body.instance_name || '').trim()

      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1)
      }

      const profile = $app.findFirstRecordByData('user_profiles', 'user', userId)
      const orgId = profile.getString('organization_id') || 'org_ademicon_default'

      // Check role
      const userRole = profile.getString('role')
      if (userRole !== 'admin' && userRole !== 'gestor') {
        return e.forbiddenError(
          'Apenas gestores ou administradores podem alterar configurações de integração.',
        )
      }

      const configs = $app.findRecordsByFilter(
        'integration_configs',
        'organization_id = "' + orgId + '" && provider = "evolution_api"',
        '-created',
        1,
        0,
      )

      let record
      if (configs.length > 0) {
        record = configs[0]
      } else {
        const col = $app.findCollectionByNameOrId('integration_configs')
        record = new Record(col)
        record.set('organization_id', orgId)
        record.set('provider', 'evolution_api')
      }

      if (baseUrl) record.set('base_url', baseUrl)
      if (apiKey && !apiKey.includes('••••')) {
        record.set('api_key', apiKey)
      }
      if (instanceName) record.set('instance_name', instanceName)
      record.set('is_active', true)
      $app.save(record)

      // Audit log
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('user', userId)
        audit.set('action', 'evolution_api_config_updated')
        audit.set('entity_type', 'integration_configs')
        audit.set('entity_id', record.id)
        audit.set('details', { base_url: baseUrl, instance_name: instanceName })
        $app.save(audit)
      } catch (_) {}

      return e.json(200, {
        ok: true,
        message: 'Configurações da Evolution API salvas com sucesso.',
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao salvar configuração' })
    }
  },
  $apis.requireAuth(),
)

// Connect or fetch QR Code from Evolution instance
routerAdd(
  'POST',
  '/backend/v1/integrations/evolution/connect',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

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

      if (!baseUrl || !apiKey) {
        return e.json(200, {
          is_demo: true,
          status: 'connected',
          message: 'Modo demonstração ativo (sem credenciais Evolution configuradas).',
        })
      }

      // 1. Try connect endpoint on Evolution (GET /instance/connect/{instance})
      let qrcode = null
      let state = 'connecting'
      let errorMessage = ''

      try {
        // First try to create instance if not exists
        try {
          $http.send({
            url: baseUrl + '/instance/create',
            method: 'POST',
            headers: {
              apikey: apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              instanceName: instanceName,
              token: $security.randomString(16),
              qrcode: true,
              integration: 'WHATSAPP-BAILEYS',
            }),
            timeout: 8,
          })
        } catch (_) {}

        // Now call connect to get QR Code
        const connectRes = $http.send({
          url: baseUrl + '/instance/connect/' + encodeURIComponent(instanceName),
          method: 'GET',
          headers: {
            apikey: apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 10,
        })

        if (connectRes.statusCode >= 200 && connectRes.statusCode < 300) {
          const connectData = connectRes.json || {}
          qrcode = connectData.base64 || connectData.code || connectData.qrcode?.base64 || null
          const instState = (connectData.instance?.state || connectData.state || '').toLowerCase()
          if (instState === 'open') {
            state = 'connected'
          } else if (qrcode) {
            state = 'waiting_qr'
          } else {
            state = 'connecting'
          }
        } else {
          errorMessage = 'Status HTTP ' + connectRes.statusCode + ' ao chamar connect da Evolution'
          state = 'error'
        }
      } catch (callErr) {
        state = 'error'
        errorMessage = callErr.message || 'Falha ao conectar com VPS da Evolution'
      }

      // Update whatsapp_instances table
      try {
        let existingInst = null
        try {
          existingInst = $app.findFirstRecordByData('whatsapp_instances', 'user', userId)
        } catch (_) {}

        if (!existingInst) {
          const waCol = $app.findCollectionByNameOrId('whatsapp_instances')
          existingInst = new Record(waCol)
          existingInst.set('user', userId)
        }

        existingInst.set('instance_name', instanceName)
        existingInst.set(
          'status',
          state === 'connected' ? 'connected' : state === 'error' ? 'error' : 'connecting',
        )
        existingInst.set('provider', 'evolution_api')
        existingInst.set('provider_instance_id', instanceName)
        existingInst.set('is_demo', false)
        $app.save(existingInst)

        // Update profile
        if (state === 'connected') {
          try {
            const prof = $app.findFirstRecordByData('user_profiles', 'user', userId)
            prof.set('whatsapp_connected', true)
            $app.save(prof)
          } catch (_) {}
        }
      } catch (_) {}

      return e.json(200, {
        is_demo: false,
        status: state,
        qrcode: qrcode,
        instance_name: instanceName,
        error: errorMessage,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao conectar instância' })
    }
  },
  $apis.requireAuth(),
)

// Disconnect instance
routerAdd(
  'POST',
  '/backend/v1/integrations/evolution/disconnect',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

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

      if (baseUrl && apiKey) {
        try {
          $http.send({
            url: baseUrl + '/instance/logout/' + encodeURIComponent(instanceName),
            method: 'DELETE',
            headers: {
              apikey: apiKey,
            },
            timeout: 5,
          })
        } catch (_) {}
      }

      // Update whatsapp_instances table
      try {
        const existingInst = $app.findFirstRecordByData('whatsapp_instances', 'user', userId)
        existingInst.set('status', 'disconnected')
        $app.save(existingInst)
      } catch (_) {}

      try {
        const prof = $app.findFirstRecordByData('user_profiles', 'user', userId)
        prof.set('whatsapp_connected', false)
        $app.save(prof)
      } catch (_) {}

      return e.json(200, { ok: true, status: 'disconnected' })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao desconectar' })
    }
  },
  $apis.requireAuth(),
)
