/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('users')
    const commercialLabels = app.findCollectionByNameOrId('commercial_labels')
    const knowledgeDocs = app.findCollectionByNameOrId('knowledge_documents')
    const userProfiles = app.findCollectionByNameOrId('user_profiles')
    const whatsappInstances = app.findCollectionByNameOrId('whatsapp_instances')
    const contacts = app.findCollectionByNameOrId('contacts')
    const conversations = app.findCollectionByNameOrId('conversations')
    const messages = app.findCollectionByNameOrId('messages')
    const opportunities = app.findCollectionByNameOrId('opportunities')
    const aiSuggestions = app.findCollectionByNameOrId('ai_suggestions')
    const followups = app.findCollectionByNameOrId('followups')
    const tasks = app.findCollectionByNameOrId('tasks')
    const calendarEvents = app.findCollectionByNameOrId('calendar_events')
    const calendarConnections = app.findCollectionByNameOrId('calendar_connections')

    // 1. Seed 15 Commercial Labels
    const labelsSeed = [
      {
        name: 'Novo Lead',
        color: '#6366F1',
        description: 'Lead recém-chegado sem triagem inicial',
      },
      {
        name: 'Qualificação',
        color: '#3B82F6',
        description: 'Entendendo objetivos, dores e orçamento',
      },
      {
        name: 'Oportunidade',
        color: '#0EA5E9',
        description: 'Lead qualificado com interesse real identificado',
      },
      {
        name: 'Reunião Sugerida',
        color: '#F59E0B',
        description: 'IA detectou timing favorável para propor reunião',
      },
      { name: 'Reunião Agendada', color: '#10B981', description: 'Reunião confirmada na agenda' },
      {
        name: 'Reunião Realizada',
        color: '#059669',
        description: 'Reunião executada, aguardando desfecho',
      },
      { name: 'Proposta', color: '#8B5CF6', description: 'Proposta de valor ou simulação enviada' },
      {
        name: 'Negociação',
        color: '#EC4899',
        description: 'Ajuste de condições finais e fechamento',
      },
      { name: 'Follow-up', color: '#F97316', description: 'Compromisso de retorno agendado' },
      {
        name: 'Aguardando Cliente',
        color: '#94A3B8',
        description: 'Pendente resposta ou documento do cliente',
      },
      { name: 'Venda', color: '#16A34A', description: 'Contrato fechado com sucesso' },
      { name: 'Perdido', color: '#EF4444', description: 'Oportunidade arquivada ou declinada' },
      {
        name: 'Nutrição',
        color: '#64748B',
        description: 'Manter relacionamento para compra futura',
      },
      { name: 'Cliente', color: '#14B8A6', description: 'Cliente da base ativa' },
      { name: 'Parceiro', color: '#84CC16', description: 'Correspondente ou parceiro comercial' },
    ]

    for (const item of labelsSeed) {
      try {
        app.findFirstRecordByData('commercial_labels', 'name', item.name)
      } catch (_) {
        const rec = new Record(commercialLabels)
        rec.set('name', item.name)
        rec.set('color', item.color)
        rec.set('description', item.description)
        app.save(rec)
      }
    }

    // 2. Seed 3 Approved Knowledge Documents
    const docsSeed = [
      {
        title: 'Política de Crédito Imobiliário — Regras Gerais',
        category: 'Crédito Imobiliário',
        version: 'v2.4',
        valid_until: '2027-12-31',
        responsible: 'Arthur (Supervisão Comercial)',
        published_at: '2026-01-15',
        status: 'approved',
        content: `Linhas de consórcio e crédito imobiliário:
- Faixas de crédito: R$ 300.000 a R$ 2.500.000 para aquisição residencial e comercial.
- Taxa de administração média: 14% a 18% total dividida no prazo do plano (180 a 240 meses).
- Prazo de carência: 30 dias para primeiro vencimento.
- Lance embutido: permitido utilizar até 30% da própria carta de crédito como lance.
- FGTS: pode ser utilizado como complemento de lance ou abatimento do saldo devedor de acordo com normas da CEF.
- Regra de ouro: nunca prometer data de contemplação por sorteio. Contemplações aceleradas ocorrem via planejamento de lances livres e embutidos.`,
      },
      {
        title: 'Perguntas Frequentes — Financiamento vs. Consórcio',
        category: 'Scripts de Venda',
        version: 'v1.8',
        valid_until: '2027-12-31',
        responsible: 'Arthur (Treinamento)',
        published_at: '2026-02-10',
        status: 'approved',
        content: `Perguntas frequentes e respostas consultivas:
1. "Por que consórcio em vez de financiamento bancário?"
Resposta consultiva: "No financiamento bancário com juros de 11% a 13% a.a., você chega a pagar 2 a 3 imóveis no final de 30 anos. No consórcio imobiliário planejado, a taxa de administração é prefixada (cerca de 1,2% a.a. equivalente), gerando uma economia de até 60% no custo total."
2. "E se eu precisar do imóvel para morar em até 6 meses?"
Resposta: "Nesse cenário, analisamos sua capacidade de lance livre ou lance embutido. Se não houver recurso para lance competitivo, o financiamento tradicional ou transição pontual pode ser mais assertivo."
3. "Posso usar meu sócio ou cônjuge para compor renda?"
Resposta: "Sim, composição de renda é aceita em até 3 proponentes no mesmo grupo."`,
      },
      {
        title: 'Script de Primeiro Contato e Qualificação de Lead',
        category: 'Treinamento Comercial',
        version: 'v3.0',
        valid_until: '2027-12-31',
        responsible: 'Arthur (Liderança)',
        published_at: '2026-03-01',
        status: 'approved',
        content: `Etapas essenciais de triagem:
1. Cumprimento caloroso e direto: mencionar onde o lead conheceu a solução.
2. Identificação do objetivo real: "Você procura imóvel para morar ou investimento para renda patrimonial?"
3. Janela de urgência: "Em quanto tempo você gostaria de ter essa chave na mão?"
4. Capacidade de investimento mensal e reserva para lance.
5. Regra do próximo passo: Nunca terminar mensagem em ponto final sem uma pergunta que estimule a continuidade ou convite para alinhamento de 15 minutos.`,
      },
    ]

    for (const item of docsSeed) {
      try {
        app.findFirstRecordByData('knowledge_documents', 'title', item.title)
      } catch (_) {
        const rec = new Record(knowledgeDocs)
        rec.set('title', item.title)
        rec.set('category', item.category)
        rec.set('version', item.version)
        rec.set('valid_until', item.valid_until)
        rec.set('responsible', item.responsible)
        rec.set('published_at', item.published_at)
        rec.set('status', item.status)
        rec.set('content', item.content)
        app.save(rec)
      }
    }

    // 3. Seed user arth.ademicon@gmail.com with password Skip@Pass
    let userRecord
    try {
      userRecord = app.findAuthRecordByEmail('users', 'arth.ademicon@gmail.com')
    } catch (_) {
      userRecord = new Record(usersCollection)
      userRecord.setEmail('arth.ademicon@gmail.com')
      userRecord.setPassword('Skip@Pass')
      userRecord.setVerified(true)
      userRecord.set('name', 'Arthur Ademicon')
      app.save(userRecord)
    }
    const userId = userRecord.id

    // 4. Seed user_profiles
    let profileRecord
    try {
      profileRecord = app.findFirstRecordByData('user_profiles', 'user', userId)
    } catch (_) {
      profileRecord = new Record(userProfiles)
      profileRecord.set('user', userId)
      profileRecord.set('role', 'admin')
      profileRecord.set('organization_id', 'org_ademicon_default')
      profileRecord.set('autonomy_mode', 'copilot_automations')
      profileRecord.set('business_hours', [
        { day: 'Segunda-feira', start: '08:00', end: '18:00', enabled: true },
        { day: 'Terça-feira', start: '08:00', end: '18:00', enabled: true },
        { day: 'Quarta-feira', start: '08:00', end: '18:00', enabled: true },
        { day: 'Quinta-feira', start: '08:00', end: '18:00', enabled: true },
        { day: 'Sexta-feira', start: '08:00', end: '18:00', enabled: true },
        { day: 'Sábado', start: '09:00', end: '13:00', enabled: false },
        { day: 'Domingo', start: '00:00', end: '00:00', enabled: false },
      ])
      profileRecord.set('whatsapp_connected', true)
      profileRecord.set('google_calendar_connected', true)
      app.save(profileRecord)
    }

    // 5. Seed whatsapp_instances (connected demo)
    let waRecord
    try {
      waRecord = app.findFirstRecordByData('whatsapp_instances', 'user', userId)
    } catch (_) {
      waRecord = new Record(whatsappInstances)
      waRecord.set('user', userId)
      waRecord.set('instance_name', 'WhatsApp Principal Arthur')
      waRecord.set('status', 'connected')
      waRecord.set('provider', 'demo')
      waRecord.set('provider_instance_id', 'wa_demo_arthur_01')
      waRecord.set('is_demo', true)
      app.save(waRecord)
    }
    const waId = waRecord.id

    // 6. Seed calendar_connections
    let calConnRecord
    try {
      calConnRecord = app.findFirstRecordByData('calendar_connections', 'user', userId)
    } catch (_) {
      calConnRecord = new Record(calendarConnections)
      calConnRecord.set('user', userId)
      calConnRecord.set('provider', 'google')
      calConnRecord.set('is_connected', true)
      calConnRecord.set('provider_account_email', 'arth.ademicon@gmail.com')
      calConnRecord.set('is_demo', true)
      app.save(calConnRecord)
    }

    // 7. Seed Sample Contacts & Conversations
    const demoContactsData = [
      {
        name: 'Roberto Lima',
        phone: '+55 11 98765-4321',
        profile: 'Empresário do ramo logístico buscando galpão e diversificação patrimonial',
        category: 'lead',
        stage: 'reuniao',
        temperature: 'quente',
        potential_value: 1200000,
        product_interest: 'Crédito Imobiliário Comercial - Galpão',
        objective: 'Comprar galpão de 800m² para sair do aluguel de R$ 22.000/mês',
        urgency: 'Alta — contrato de locação atual vence em 6 meses',
        pain_point: 'Juros abusivos dos bancos comerciais (13,5% a.a.)',
        motivation: 'Economizar mais de R$ 600 mil em juros e criar patrimônio próprio da empresa',
        summary:
          'Roberto demonstrou interesse após ver o comparativo de custo entre financiamento e consórcio. Confirmou interesse em fazer reunião.',
        next_best_action:
          'Avance para reunião: apresente disponibilidade para terça ou quarta e envie convite formal.',
        next_action_date: '2026-09-24T15:00:00Z',
        messages: [
          {
            dir: 'inbound',
            content: 'Oi Arthur, estive pensando naquela simulação de R$ 1,2 milhão que você fez.',
            ts: '2026-09-23T10:15:00Z',
            id: 'msg_roberto_01',
          },
          {
            dir: 'outbound',
            content:
              'Olá Roberto! Que ótimo retorno. Conseguiu comparar com as taxas que seu banco ofereceu?',
            ts: '2026-09-23T10:20:00Z',
            id: 'msg_roberto_02',
          },
          {
            dir: 'inbound',
            content:
              'Sim, no banco ficava inviável. Isso me interessa sim. Você teria um horário essa semana pra conversarmos com calma?',
            ts: '2026-09-23T10:45:00Z',
            id: 'msg_roberto_03',
          },
        ],
        ai_sugg: {
          type: 'advance_to_meeting',
          next_best_action: 'Convidar para reunião de fechamento com simulação comparativa',
          reasoning_summary:
            'Cliente validou o valor de R$ 1,2M, declarou inviabilidade do banco e solicitou ativamente horário na semana. Timing ideal para agendamento.',
          confidence: 0.94,
          suggested_response: [
            'Consultiva: Olá Roberto! Excelente iniciativa. Tenho terça às 15h ou quarta às 10h para desenharmos o plano exato de contemplação. Algum funciona para você?',
            'Direta: Perfeito Roberto! Que tal amanhã às 15h para detalharmos o cronograma de lances?',
            'Investigativa: Ótimo Roberto! Antes de alinharmos quarta às 10h, o seu sócio ou diretor financeiro também participará da decisão?',
          ],
        },
      },
      {
        name: 'Fernanda Costa',
        phone: '+55 11 97654-3210',
        profile: 'Arquiteta e investidora focada em apartamentos compactos para locação',
        category: 'lead',
        stage: 'proposta',
        temperature: 'morna',
        potential_value: 600000,
        product_interest: 'Consórcio Imobiliário Residencial - 2 Cartas de 300k',
        objective: 'Alavancar carteira de locação residencial em Pinheiros',
        urgency: 'Média — aguardando alinhamento com sócio em 15/10',
        pain_point: 'Incerteza sobre o prazo para contemplação via lance livre',
        motivation: 'Renda passiva com aluguel acima do CDI',
        summary:
          'Recebeu proposta formal de duas cartas de R$ 300 mil. Informou que vai debater com o sócio e pediu retorno após o dia 15.',
        next_best_action:
          'Follow-up programado: retomar contato após alinhamento de sócios e enviar estudo de vacância.',
        next_action_date: '2026-10-16T14:00:00Z',
        messages: [
          {
            dir: 'outbound',
            content:
              'Oi Fernanda! Conseguiu abrir o PDF com o planejamento das duas cartas de R$ 300 mil?',
            ts: '2026-09-22T14:10:00Z',
            id: 'msg_fernanda_01',
          },
          {
            dir: 'inbound',
            content: 'Ainda estou avaliando a proposta com meu sócio, te retorno depois do dia 15.',
            ts: '2026-09-22T16:30:00Z',
            id: 'msg_fernanda_02',
          },
        ],
        ai_sugg: {
          type: 'create_followup',
          next_best_action:
            'Agendar follow-up estruturado para o dia 16/10 respeitando o timing do sócio',
          reasoning_summary:
            'Cliente estipulou data concreta de retorno com sócio. Evitar cobrança antecipada invasiva; programar abordagem técnica pós-dia 15.',
          confidence: 0.88,
          suggested_response: [
            'Consultiva: Perfeito Fernanda! Fica combinado assim. No dia 16 te envio uma rápida mensagem para sabermos como foi a conversa com seu sócio. Bom trabalho por aí!',
            'Direta: Combinado Fernanda! Deixo reservada nossa conversa para o dia 16. Um abraço!',
            'Investigativa: Combinado! Se você ou ele precisarem de alguma simulação complementar de rentabilidade antes do dia 15, estou à disposição.',
          ],
        },
      },
      {
        name: 'Matheus Almeida',
        phone: '+55 21 99887-1122',
        profile: 'Médico cardiologista, quer sair do aluguel e comprar cobertura na Barra',
        category: 'lead',
        stage: 'qualificacao',
        temperature: 'quente',
        potential_value: 850000,
        product_interest: 'Aquisição de imóvel na planta',
        objective: 'Comprar apartamento na planta com menor desembolso inicial',
        urgency: 'Alta — lançamento encerra condições especiais este mês',
        pain_point: 'Não entende como consórcio ou crédito atua em imóvel ainda na planta',
        motivation: 'Conforto para a família sem imobilizar capital líquido de consultório',
        summary:
          'Lead recém-chegado via campanha de cobertura na planta. Pediu explicação clara de viabilidade.',
        next_best_action:
          'Explicar conceito de quitação na entrega das chaves e uso do crédito para abater saldo devedor da construtora.',
        next_action_date: '2026-09-23T18:00:00Z',
        messages: [
          {
            dir: 'inbound',
            content:
              'Oi Arthur, vi o material que você mandou. Pode me explicar melhor como funciona o financiamento de imóvel na planta?',
            ts: '2026-09-23T11:00:00Z',
            id: 'msg_matheus_01',
          },
        ],
        ai_sugg: {
          type: 'explain_concept',
          next_best_action: 'Explicar estratégia de quitação de chaves com carta de crédito',
          reasoning_summary:
            'Cliente interessado e com alta capacidade financeira, mas com dúvida técnica sobre a mecânica em imóveis na planta. Explicação didática gera autoridade imediata.',
          confidence: 0.91,
          suggested_response: [
            'Consultiva: Olá Matheus! Funciona perfeitamente: durante a obra você paga as parcelas suaves da construtora e, ao chegar nas chaves, usamos nossa carta de crédito para quitar o saldo devedor à vista com desconto, fugindo dos juros bancários. Faz sentido para o seu planejamento?',
            'Direta: Olá Matheus! Você programa a contemplação para o ano de entrega das chaves e liquida a construtora sem juros bancários. Quer ver uma simulação prática?',
            'Investigativa: Olá Dr. Matheus! Com certeza. A entrega da sua obra está prevista para quando? Assim te mostro exatamente a melhor estratégia.',
          ],
        },
      },
      {
        name: 'Juliana Mendes',
        phone: '+55 31 98822-3344',
        profile: 'Diretora financeira de grupo educacional',
        category: 'lead',
        stage: 'negociacao',
        temperature: 'quente',
        potential_value: 2000000,
        product_interest: 'Estruturação patrimonial e expansão de unidades',
        objective: 'Adquirir prédio sede em BH',
        urgency: 'Crítica — conselho deliberativo reúne sexta-feira',
        pain_point: 'Aguardando ajuste contratual sobre lance embutido de 30%',
        motivation: 'Economia de mais de R$ 1 milhão em custos financeiros',
        summary:
          'Negociação avançada de 4 cotas de R$ 500 mil. Reunião prévia realizada com aprovação da diretoria.',
        next_best_action:
          'Responder agora: validar documentação e enviar minuta para deliberação do conselho.',
        next_action_date: '2026-09-23T16:00:00Z',
        messages: [
          {
            dir: 'outbound',
            content:
              'Juliana, ajustamos a minuta com a regra de lance embutido de 30% conforme seu pedido.',
            ts: '2026-09-22T17:00:00Z',
            id: 'msg_juliana_01',
          },
          {
            dir: 'inbound',
            content:
              'Perfeito Arthur, vou incluir na pauta do conselho para sexta. Me mande a versão final assinada.',
            ts: '2026-09-23T08:30:00Z',
            id: 'msg_juliana_02',
          },
        ],
        ai_sugg: {
          type: 'send_content',
          next_best_action:
            'Enviar minuta finalizada em PDF com checklist para votação do conselho',
          reasoning_summary:
            'Oportunidade em estágio decisivo (R$ 2,0M). Conselho deliberativo sexta-feira. Resposta imediata garante que o item entre com prioridade na pauta.',
          confidence: 0.95,
          suggested_response: [
            'Consultiva: Bom dia, Juliana! Segue anexo o documento oficial formatado para o conselho. Qualquer ponto técnico que eles levantarem, posso entrar online por 10 minutos para esclarecer.',
            'Direta: Minuta enviada em PDF, Juliana! Bons negócios na sexta e fico a postos.',
            'Investigativa: Enviado Juliana! Há mais algum conselheiro que precise de resumo executivo prévio?',
          ],
        },
      },
      {
        name: 'Carlos Silveira',
        phone: '+55 41 99111-2233',
        profile: 'Dentista com clínica própria',
        category: 'lead',
        stage: 'oportunidade',
        temperature: 'fria',
        potential_value: 450000,
        product_interest: 'Consórcio Imobiliário - Sala Comercial',
        objective: 'Comprar sala anexa para expansão do consultório',
        urgency: 'Baixa — sem retorno há 8 dias',
        pain_point: 'Medo de comprometer o fluxo de caixa mensal',
        motivation: 'Ter a clínica própria definitiva',
        summary: 'Oportunidade estagnada sem próxima ação definida há mais de 7 dias.',
        next_best_action:
          'Reativar oportunidade com pergunta investigativa sobre o fluxo de caixa.',
        next_action_date: null,
        messages: [
          {
            dir: 'outbound',
            content: 'Carlos, conseguiu olhar aquela simulação da sala ao lado da sua clínica?',
            ts: '2026-09-14T10:00:00Z',
            id: 'msg_carlos_01',
          },
        ],
        ai_sugg: {
          type: 'reactivate_opportunity',
          next_best_action:
            'Reativar contato com abordagem de baixo atrito focada na parcela reduzida até contemplação',
          reasoning_summary:
            'Contato estagnado há mais de uma semana sem próxima ação definida. Risco de perda por desengajamento.',
          confidence: 0.76,
          suggested_response: [
            'Consultiva: Olá Carlos, tudo bem por aí? Notei que a principal preocupação era não apertar o caixa da clínica. Temos um plano com meia parcela até a contemplação. Valeria 5 minutos para te mostrar esse formato?',
            'Direta: Carlos, tudo bem? Conseguimos uma condição com parcela 50% reduzida até você pegar a chave da sala.',
            'Investigativa: Olá Carlos! A expansão da clínica ainda é uma meta para este semestre ou você preferiu postergar para o próximo ano?',
          ],
        },
      },
    ]

    for (const cData of demoContactsData) {
      let contactRec
      try {
        contactRec = app.findFirstRecordByData('contacts', 'phone', cData.phone)
      } catch (_) {
        contactRec = new Record(contacts)
        contactRec.set('consultant', userId)
        contactRec.set('whatsapp_instance', waId)
        contactRec.set('name', cData.name)
        contactRec.set('phone', cData.phone)
        contactRec.set('profile', cData.profile)
        contactRec.set('category', cData.category)
        contactRec.set('organization_id', 'org_ademicon_default')
        app.save(contactRec)
      }

      let convRec
      try {
        convRec = app.findFirstRecordByData('conversations', 'contact', contactRec.id)
      } catch (_) {
        convRec = new Record(conversations)
        convRec.set('consultant', userId)
        convRec.set('contact', contactRec.id)
        convRec.set('whatsapp_instance', waId)
        convRec.set('commercial_stage', cData.stage)
        convRec.set('temperature', cData.temperature)
        convRec.set('potential_value', cData.potential_value)
        convRec.set('product_interest', cData.product_interest)
        convRec.set('objective', cData.objective)
        convRec.set('urgency', cData.urgency)
        convRec.set('pain_point', cData.pain_point)
        convRec.set('motivation', cData.motivation)
        convRec.set('summary', cData.summary)
        convRec.set('next_best_action', cData.next_best_action)
        if (cData.next_action_date) convRec.set('next_action_date', cData.next_action_date)
        convRec.set('last_interaction_at', '2026-09-23T11:00:00Z')
        convRec.set('organization_id', 'org_ademicon_default')
        app.save(convRec)
      }

      // Opportunity
      let oppRec
      try {
        oppRec = app.findFirstRecordByData('opportunities', 'conversation', convRec.id)
      } catch (_) {
        oppRec = new Record(opportunities)
        oppRec.set('consultant', userId)
        oppRec.set('contact', contactRec.id)
        oppRec.set('conversation', convRec.id)
        oppRec.set('stage', cData.stage)
        oppRec.set('potential_value', cData.potential_value)
        oppRec.set('product_interest', cData.product_interest)
        oppRec.set(
          'status',
          cData.stage === 'perdido' ? 'lost' : cData.next_action_date ? 'open' : 'stalled',
        )
        oppRec.set('organization_id', 'org_ademicon_default')
        app.save(oppRec)
      }

      // Messages
      for (const msg of cData.messages) {
        try {
          app.findFirstRecordByData('messages', 'provider_event_id', msg.id)
        } catch (_) {
          const msgRec = new Record(messages)
          msgRec.set('consultant', userId)
          msgRec.set('conversation', convRec.id)
          msgRec.set('contact', contactRec.id)
          msgRec.set('whatsapp_instance', waId)
          msgRec.set('direction', msg.dir)
          msgRec.set('message_type', 'text')
          msgRec.set('content', msg.content)
          msgRec.set('timestamp', msg.ts)
          msgRec.set('provider_event_id', msg.id)
          msgRec.set('organization_id', 'org_ademicon_default')
          app.save(msgRec)
        }
      }

      // AI Suggestions
      if (cData.ai_sugg) {
        try {
          app.findFirstRecordByData('ai_suggestions', 'conversation', convRec.id)
        } catch (_) {
          const suggRec = new Record(aiSuggestions)
          suggRec.set('consultant', userId)
          suggRec.set('conversation', convRec.id)
          suggRec.set('type', cData.ai_sugg.type)
          suggRec.set('commercial_stage', cData.stage)
          suggRec.set('next_best_action', cData.ai_sugg.next_best_action)
          suggRec.set('reasoning_summary', cData.ai_sugg.reasoning_summary)
          suggRec.set('confidence', cData.ai_sugg.confidence)
          suggRec.set('suggested_response', cData.ai_sugg.suggested_response)
          suggRec.set('status', 'pending')
          suggRec.set('meeting_recommended', cData.ai_sugg.type === 'advance_to_meeting')
          suggRec.set('follow_up_required', cData.ai_sugg.type === 'create_followup')
          suggRec.set('organization_id', 'org_ademicon_default')
          app.save(suggRec)
        }
      }
    }

    // 8. Seed Follow-ups
    const robertoContact = app.findFirstRecordByData('contacts', 'name', 'Roberto Lima')
    const robertoConv = app.findFirstRecordByData('conversations', 'contact', robertoContact.id)
    const fernandaContact = app.findFirstRecordByData('contacts', 'name', 'Fernanda Costa')
    const fernandaConv = app.findFirstRecordByData('conversations', 'contact', fernandaContact.id)

    try {
      app.findFirstRecordByData(
        'followups',
        'reason',
        'Alinhar horários e confirmar reunião para galpão',
      )
    } catch (_) {
      const f1 = new Record(followups)
      f1.set('consultant', userId)
      f1.set('conversation', robertoConv.id)
      f1.set('contact', robertoContact.id)
      f1.set('reason', 'Alinhar horários e confirmar reunião para galpão')
      f1.set('scheduled_date', '2026-09-24T10:00:00Z')
      f1.set('status', 'scheduled')
      f1.set(
        'suggested_text',
        'Olá Roberto, passando para confirmar se terça às 15h ou quarta às 10h fica melhor para alinharmos os detalhes.',
      )
      f1.set('is_automatic', false)
      f1.set('organization_id', 'org_ademicon_default')
      app.save(f1)
    }

    try {
      app.findFirstRecordByData('followups', 'reason', 'Retomar conversa após reunião com sócio')
    } catch (_) {
      const f2 = new Record(followups)
      f2.set('consultant', userId)
      f2.set('conversation', fernandaConv.id)
      f2.set('contact', fernandaContact.id)
      f2.set('reason', 'Retomar conversa após reunião com sócio')
      f2.set('scheduled_date', '2026-10-16T14:00:00Z')
      f2.set('status', 'scheduled')
      f2.set(
        'suggested_text',
        'Oi Fernanda, tudo bem? Como foi a conversa com seu sócio sobre o plano de duas cotas? Seguem os números revisados.',
      )
      f2.set('is_automatic', true)
      f2.set('organization_id', 'org_ademicon_default')
      app.save(f2)
    }

    // Overdue follow-up for testing
    try {
      app.findFirstRecordByData('followups', 'reason', 'Follow-up pós-envio de proposta inicial')
    } catch (_) {
      const carlosContact = app.findFirstRecordByData('contacts', 'name', 'Carlos Silveira')
      const carlosConv = app.findFirstRecordByData('conversations', 'contact', carlosContact.id)
      const f3 = new Record(followups)
      f3.set('consultant', userId)
      f3.set('conversation', carlosConv.id)
      f3.set('contact', carlosContact.id)
      f3.set('reason', 'Follow-up pós-envio de proposta inicial')
      f3.set('scheduled_date', '2026-09-20T11:00:00Z')
      f3.set('status', 'scheduled')
      f3.set(
        'suggested_text',
        'Olá Carlos! Passando para ver se restou alguma dúvida no estudo da sala.',
      )
      f3.set('is_automatic', false)
      f3.set('organization_id', 'org_ademicon_default')
      app.save(f3)
    }

    // 9. Seed Tasks
    const tasksSeed = [
      {
        title: 'Preparar comparativo banco vs. consórcio para Roberto',
        due: '2026-09-24T12:00:00Z',
        status: 'open',
        source: 'ai',
        conv: robertoConv.id,
      },
      {
        title: 'Revisar minuta de contrato com departamento jurídico',
        due: '2026-09-23T17:00:00Z',
        status: 'open',
        source: 'manual',
        conv: null,
      },
      {
        title: 'Atualizar tabela de lances médios de setembro',
        due: '2026-09-25T18:00:00Z',
        status: 'open',
        source: 'manual',
        conv: null,
      },
    ]

    for (const t of tasksSeed) {
      try {
        app.findFirstRecordByData('tasks', 'title', t.title)
      } catch (_) {
        const rec = new Record(tasks)
        rec.set('consultant', userId)
        rec.set('title', t.title)
        rec.set('due_date', t.due)
        rec.set('status', t.status)
        rec.set('source', t.source)
        if (t.conv) rec.set('conversation', t.conv)
        rec.set('organization_id', 'org_ademicon_default')
        app.save(rec)
      }
    }

    // 10. Seed Calendar Events
    try {
      app.findFirstRecordByData(
        'calendar_events',
        'title',
        'Apresentação de Projeto — Roberto Lima (Galpão)',
      )
    } catch (_) {
      const ce = new Record(calendarEvents)
      ce.set('consultant', userId)
      ce.set('conversation', robertoConv.id)
      ce.set('contact', robertoContact.id)
      ce.set('title', 'Apresentação de Projeto — Roberto Lima (Galpão)')
      ce.set('date', '2026-09-25T15:00:00Z')
      ce.set('meeting_type', 'Reunião Online (Google Meet)')
      ce.set('status', 'scheduled')
      ce.set('provider_event_id', 'gcal_event_demo_01')
      ce.set('organization_id', 'org_ademicon_default')
      app.save(ce)
    }
  },
  (app) => {
    // Seeds down migration
  },
)
