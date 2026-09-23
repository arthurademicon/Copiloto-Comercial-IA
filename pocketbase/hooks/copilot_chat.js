// Copilot natural chat hook — conversational interface for the consultant in /copiloto
routerAdd(
  'POST',
  '/backend/v1/copilot/chat',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const body = e.requestInfo().body || {}
      const message = (body.message || '').trim()
      const conversationId = body.conversation_id || null

      if (!message) return e.badRequestError('message is required')

      // Optional context injection from PB
      let contextExtra = ''
      if (conversationId) {
        try {
          const conv = $app.findFirstRecordByData('conversations', 'id', conversationId)
          let contactName = 'Cliente'
          try {
            const contact = $app.findFirstRecordByData('contacts', 'id', conv.getString('contact'))
            contactName = contact.getString('name')
          } catch (_) {}
          contextExtra =
            ' [Contexto da conversa com ' +
            contactName +
            ', Estágio: ' +
            conv.getString('commercial_stage') +
            ', Valor: R$ ' +
            conv.getInt('potential_value') +
            ']'
        } catch (_) {}
      }

      const fullPrompt = message + contextExtra

      const result = $ai.agent('commercial-copilot').chat({
        user_id: userId,
        message: fullPrompt,
      })

      return e.json(200, {
        content: result.content,
        citations: result.citations || [],
        message_id: result.message_id || '',
      })
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Motor de IA indisponível temporariamente.' })
      }
      return e.json(500, { error: err.message || 'Erro ao consultar Copiloto Comercial' })
    }
  },
  $apis.requireAuth(),
)
