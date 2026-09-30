// Pluggable AI Configuration endpoints
// Allows admin/gestor to configure and switch AI models/providers per tenant

routerAdd(
  'GET',
  '/backend/v1/ai/config',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const profile = $app.findFirstRecordByData('user_profiles', 'user', userId)
      const orgId = profile.getString('organization_id') || 'org_ademicon_default'

      let config = {
        provider: 'skip_agent',
        model: 'commercial-copilot',
        temperature: 0.7,
        is_active: true,
        custom_endpoint: '',
        has_custom_key: false,
        organization_id: orgId,
      }

      try {
        const configs = $app.findRecordsByFilter(
          'ai_configs',
          'organization_id = "' + orgId + '"',
          '-created',
          1,
          0,
        )
        if (configs.length > 0) {
          const c = configs[0]
          config.provider = c.getString('provider') || 'skip_agent'
          config.model = c.getString('model') || 'commercial-copilot'
          config.temperature = c.getFloat('temperature') || 0.7
          config.custom_endpoint = c.getString('custom_endpoint') || ''
          config.has_custom_key = Boolean(c.getString('api_key'))
          config.is_active = c.getBool('is_active')
        }
      } catch (_) {}

      return e.json(200, {
        ok: true,
        config: config,
        available_providers: [
          {
            id: 'skip_agent',
            name: 'Skip Cloud AI (Nativo - Recomendado)',
            models: ['commercial-copilot'],
            description: 'Agente nativo pré-treinado com contexto de vendas e RAG de conhecimento',
          },
          {
            id: 'openai',
            name: 'OpenAI Oficial',
            models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
            description: 'Utilize sua chave OpenAI via API direta',
          },
          {
            id: 'anthropic',
            name: 'Anthropic Claude',
            models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
            description: 'Capacidade analítica e tom consultivo avançado',
          },
          {
            id: 'custom_openrouter',
            name: 'OpenRouter / Endpoint Compatível OpenAI',
            models: ['deepseek/deepseek-chat', 'meta-llama/llama-3.3-70b-instruct'],
            description: 'Roteamento flexível para modelos open source e multi-cloud',
          },
        ],
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao consultar configuração de IA' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/ai/config',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const profile = $app.findFirstRecordByData('user_profiles', 'user', userId)
      const userRole = profile.getString('role')
      if (userRole !== 'admin' && userRole !== 'gestor') {
        return e.forbiddenError(
          'Apenas administradores ou gestores podem configurar o provedor de IA.',
        )
      }

      const orgId = profile.getString('organization_id') || 'org_ademicon_default'
      const body = e.requestInfo().body || {}
      const provider = body.provider || 'skip_agent'
      const model = body.model || 'commercial-copilot'
      const temperature = body.temperature !== undefined ? parseFloat(body.temperature) : 0.7
      const apiKey = (body.api_key || '').trim()
      const customEndpoint = (body.custom_endpoint || '').trim()
      const systemPromptOverride = (body.system_prompt_override || '').trim()

      const configs = $app.findRecordsByFilter(
        'ai_configs',
        'organization_id = "' + orgId + '"',
        '-created',
        1,
        0,
      )

      let record
      if (configs.length > 0) {
        record = configs[0]
      } else {
        const col = $app.findCollectionByNameOrId('ai_configs')
        record = new Record(col)
        record.set('organization_id', orgId)
      }

      record.set('provider', provider)
      record.set('model', model)
      record.set('temperature', temperature)
      if (apiKey && !apiKey.includes('••••')) {
        record.set('api_key', apiKey)
      }
      record.set('custom_endpoint', customEndpoint)
      record.set('system_prompt_override', systemPromptOverride)
      record.set('is_active', true)
      $app.save(record)

      // Audit log
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('user', userId)
        audit.set('action', 'ai_config_updated')
        audit.set('entity_type', 'ai_configs')
        audit.set('entity_id', record.id)
        audit.set('details', { provider: provider, model: model })
        $app.save(audit)
      } catch (_) {}

      return e.json(200, {
        ok: true,
        message: 'Configurações do provedor de IA salvas com sucesso.',
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao salvar configuração de IA' })
    }
  },
  $apis.requireAuth(),
)
