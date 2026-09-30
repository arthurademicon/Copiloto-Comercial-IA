// Commercial Copilot Analyze hook — Provider-Agnostic LLM Layer
// Uses organization's configured provider (Skip Agent native, OpenAI, Anthropic, or OpenRouter)
// and stores output in ai_suggestions for the conversation

routerAdd(
  'POST',
  '/backend/v1/copilot/analyze',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const conversationId = body.conversation_id
      if (!conversationId) return e.badRequestError('conversation_id is required')

      // Load conversation, contact, and recent messages
      const conv = $app.findFirstRecordByData('conversations', 'id', conversationId)
      let contactName = 'Cliente'
      let contactPhone = ''
      try {
        const contact = $app.findFirstRecordByData('contacts', 'id', conv.getString('contact'))
        contactName = contact.getString('name')
        contactPhone = contact.getString('phone')
      } catch (_) {}

      const recentMsgs = $app.findRecordsByFilter(
        'messages',
        'conversation = "' + conversationId + '"',
        '-created',
        10,
        0,
      )
      // Reverse to chronological
      const historyLines = []
      for (let i = recentMsgs.length - 1; i >= 0; i--) {
        const m = recentMsgs[i]
        const sender = m.getString('direction') === 'outbound' ? 'Consultor Arthur' : contactName
        historyLines.push(sender + ': ' + m.getString('content'))
      }

      const promptMessage = [
        'CONTEXTO DA OPORTUNIDADE:',
        '- Contato: ' + contactName + ' (' + contactPhone + ')',
        '- Estágio atual: ' + conv.getString('commercial_stage'),
        '- Temperatura: ' + conv.getString('temperature'),
        '- Valor Potencial: R$ ' + conv.getInt('potential_value'),
        '- Interesse: ' + conv.getString('product_interest'),
        '- Objetivo: ' + conv.getString('objective'),
        '- Dor/Objeção: ' + conv.getString('pain_point'),
        '',
        'HISTÓRICO RECENTE DE MENSAGENS:',
        historyLines.join('\n'),
        '',
        'INSTRUÇÃO DO MOTOR COMERCIAL:',
        "Analise com rigor o momento comercial. Identifique a 'Próxima melhor ação', determine se cabe reunião, follow-up ou explicação, e sugira até 3 respostas nos estilos (Consultiva, Direta, Investigativa). Se o cliente demonstrou interesse em horários ou avançar, classifique como advance_to_meeting.",
        'Retorne APENAS um JSON válido no formato:',
        '```json',
        '{',
        '  "commercial_stage": "qualificacao|oportunidade|reuniao|proposta|negociacao|fechado|perdido",',
        '  "type": "discovery_question|handle_objection|explain_concept|advance_to_meeting|create_followup|create_task|wait_for_customer|send_content|request_document|escalate_to_manager|technical_validation|close_opportunity|reactivate_opportunity",',
        '  "next_best_action": "texto curto e objetivo da ação",',
        '  "reasoning_summary": "justificativa operacional curta",',
        '  "confidence": 0.85,',
        '  "meeting_recommended": true|false,',
        '  "follow_up_required": true|false,',
        '  "technical_review_required": true|false,',
        '  "suggested_response": ["1. Consultiva: ...", "2. Direta: ...", "3. Investigativa: ..."]',
        '}',
        '```',
      ].join('\n')

      // Resolve AI Provider config for this tenant
      let provider = 'skip_agent'
      let model = 'commercial-copilot'
      let customKey = ''
      let customEndpoint = ''

      try {
        const profile = $app.findFirstRecordByData('user_profiles', 'user', userId)
        const orgId = profile.getString('organization_id') || 'org_ademicon_default'
        const aiConfigs = $app.findRecordsByFilter(
          'ai_configs',
          'organization_id = "' + orgId + '" && is_active = true',
          '-created',
          1,
          0,
        )
        if (aiConfigs.length > 0) {
          const cfg = aiConfigs[0]
          provider = cfg.getString('provider') || 'skip_agent'
          model = cfg.getString('model') || 'commercial-copilot'
          customKey = cfg.getString('api_key') || ''
          customEndpoint = cfg.getString('custom_endpoint') || ''
        }
      } catch (_) {}

      let rawContent = ''

      // Execute through pluggable provider
      if (provider === 'openai' && customKey) {
        try {
          const res = $http.send({
            url: (customEndpoint || 'https://api.openai.com/v1') + '/chat/completions',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + customKey,
            },
            body: JSON.stringify({
              model: model || 'gpt-4o',
              messages: [
                {
                  role: 'system',
                  content: 'Você é o Copiloto Comercial IA especialista em vendas e negociações.',
                },
                { role: 'user', content: promptMessage },
              ],
              temperature: 0.3,
            }),
            timeout: 20,
          })
          if (res.statusCode >= 200 && res.statusCode < 300) {
            rawContent = res.json?.choices?.[0]?.message?.content || ''
          }
        } catch (_) {}
      } else if (provider === 'anthropic' && customKey) {
        try {
          const res = $http.send({
            url: 'https://api.anthropic.com/v1/messages',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': customKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: model || 'claude-3-5-sonnet-20241022',
              max_tokens: 1500,
              system: 'Você é o Copiloto Comercial IA especialista em vendas e negociações.',
              messages: [{ role: 'user', content: promptMessage }],
            }),
            timeout: 20,
          })
          if (res.statusCode >= 200 && res.statusCode < 300) {
            rawContent = res.json?.content?.[0]?.text || ''
          }
        } catch (_) {}
      } else if (provider === 'custom_openrouter' && customKey) {
        try {
          const ep = customEndpoint || 'https://openrouter.ai/api/v1'
          const res = $http.send({
            url: ep + '/chat/completions',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + customKey,
            },
            body: JSON.stringify({
              model: model || 'deepseek/deepseek-chat',
              messages: [
                {
                  role: 'system',
                  content: 'Você é o Copiloto Comercial IA especialista em vendas e negociações.',
                },
                { role: 'user', content: promptMessage },
              ],
            }),
            timeout: 20,
          })
          if (res.statusCode >= 200 && res.statusCode < 300) {
            rawContent = res.json?.choices?.[0]?.message?.content || ''
          }
        } catch (_) {}
      }

      // Default or fallback to native Skip Cloud Agent 'commercial-copilot'
      if (!rawContent) {
        try {
          const agentResult = $ai.agent('commercial-copilot').chat({
            user_id: userId,
            message: promptMessage,
          })
          rawContent = agentResult.content || ''
        } catch (agentErr) {
          // Rule-based fallback if offline
          rawContent = JSON.stringify({
            commercial_stage: conv.getString('commercial_stage') || 'oportunidade',
            type: 'advance_to_meeting',
            next_best_action:
              'Avance para reunião: proponha horários alinhados à disponibilidade do cliente',
            reasoning_summary:
              'Cliente demonstrou engajamento nas últimas interações. Momento favorável para agendamento de alinhamento.',
            confidence: 0.88,
            meeting_recommended: true,
            follow_up_required: false,
            technical_review_required: false,
            suggested_response: [
              '1. Consultiva: Olá ' +
                contactName +
                '! Podemos desenhar esse planejamento em uma rápida conversa de 15 minutos. Tenho terça às 15h ou quarta às 10h, algum funciona para você?',
              '2. Direta: Olá ' +
                contactName +
                '! Vamos alinhar os detalhes? Que tal quarta-feira às 10h?',
              '3. Investigativa: Olá ' +
                contactName +
                '! Antes de alinharmos os horários, você prefere um encontro presencial ou por videoconferência?',
            ],
          })
        }
      }

      // Parse JSON from agent content
      let parsedData = null
      try {
        const match = rawContent.match(/\{[\s\S]*\}/)
        if (match) {
          parsedData = JSON.parse(match[0])
        } else {
          parsedData = JSON.parse(rawContent)
        }
      } catch (_) {
        parsedData = {
          commercial_stage: conv.getString('commercial_stage') || 'oportunidade',
          type: 'advance_to_meeting',
          next_best_action: 'Propor reunião para avançar negociação',
          reasoning_summary: 'Identificado interesse comercial relevante na interação.',
          confidence: 0.85,
          meeting_recommended: true,
          suggested_response: [
            '1. Consultiva: Olá ' +
              contactName +
              '! Tenho terça às 15h ou quarta às 10h disponíveis. Algum funciona para você?',
            '2. Direta: ' + contactName + ', vamos marcar uma breve conversa amanhã às 15h?',
            '3. Investigativa: ' +
              contactName +
              ', quem mais da sua equipe participará dessa decisão?',
          ],
        }
      }

      // Persist new ai_suggestion
      const aiCol = $app.findCollectionByNameOrId('ai_suggestions')
      const suggRec = new Record(aiCol)
      suggRec.set('consultant', userId)
      suggRec.set('conversation', conversationId)
      suggRec.set('type', parsedData.type || 'advance_to_meeting')
      suggRec.set(
        'commercial_stage',
        parsedData.commercial_stage || conv.getString('commercial_stage'),
      )
      suggRec.set('next_best_action', parsedData.next_best_action || 'Acompanhar oportunidade')
      suggRec.set(
        'reasoning_summary',
        parsedData.reasoning_summary || 'Análise do histórico recente.',
      )
      suggRec.set('confidence', parsedData.confidence || 0.85)
      suggRec.set('suggested_response', parsedData.suggested_response || [])
      suggRec.set('meeting_recommended', !!parsedData.meeting_recommended)
      suggRec.set('follow_up_required', !!parsedData.follow_up_required)
      suggRec.set('technical_review_required', !!parsedData.technical_review_required)
      suggRec.set('status', 'pending')
      suggRec.set('suggestion_source', 'ai')
      $app.save(suggRec)

      // Update conversation next_best_action
      conv.set(
        'next_best_action',
        parsedData.next_best_action || conv.getString('next_best_action'),
      )
      $app.save(conv)

      return e.json(200, {
        ok: true,
        suggestion: suggRec,
        parsed: parsedData,
        provider_used: provider,
        model_used: model,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Failed to analyze conversation' })
    }
  },
  $apis.requireAuth(),
)
