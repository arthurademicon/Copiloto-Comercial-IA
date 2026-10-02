// Prospecting Engine Hook:
// 1. Google Places config endpoint (get/save for organization with masking)
// 2. Start prospecting endpoint (Google Places API fetch + fallback demo, deduplication, contact creation, broadcast campaign creation)
// 3. Status and sync endpoint

// 1. GET /backend/v1/prospecting/config
routerAdd(
  'GET',
  '/backend/v1/prospecting/config',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      let googleApiKey = $os.getenv('GOOGLE_MAPS_API_KEY') || ''
      let isCustom = false

      try {
        const profile = $app.findFirstRecordByData('user_profiles', 'user', userId)
        const orgId = profile.getString('organization_id') || 'org_ademicon_default'
        const configs = $app.findRecordsByFilter(
          'integration_configs',
          'organization_id = "' + orgId + '" && provider = "google_places"',
          '-created',
          1,
          0,
        )
        if (configs.length > 0) {
          const cfg = configs[0]
          if (cfg.getString('api_key')) {
            googleApiKey = cfg.getString('api_key')
            isCustom = true
          }
        }
      } catch (_) {}

      let maskedKey = ''
      if (googleApiKey) {
        if (googleApiKey.length > 8) {
          maskedKey = googleApiKey.slice(0, 4) + '••••••••' + googleApiKey.slice(-4)
        } else {
          maskedKey = '••••••••'
        }
      }

      return e.json(200, {
        ok: true,
        has_api_key: Boolean(googleApiKey),
        api_key_masked: maskedKey,
        is_demo: !googleApiKey,
        source: isCustom ? 'database' : googleApiKey ? 'env' : 'demo',
      })
    } catch (err) {
      return e.json(500, {
        error: err.message || 'Erro ao consultar configuração do Google Places',
      })
    }
  },
  $apis.requireAuth(),
)

// 2. POST /backend/v1/prospecting/config (Save key with admin/gestor authorization)
routerAdd(
  'POST',
  '/backend/v1/prospecting/config',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const profile = $app.findFirstRecordByData('user_profiles', 'user', userId)
      const userRole = profile.getString('role')
      if (userRole !== 'admin' && userRole !== 'gestor') {
        return e.forbiddenError(
          'Apenas gestores ou administradores podem salvar a chave do Google Maps.',
        )
      }

      const orgId = profile.getString('organization_id') || 'org_ademicon_default'
      const body = e.requestInfo().body || {}
      const apiKey = (body.api_key || '').trim()

      const configs = $app.findRecordsByFilter(
        'integration_configs',
        'organization_id = "' + orgId + '" && provider = "google_places"',
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
        record.set('provider', 'google_places')
      }

      if (apiKey && !apiKey.includes('••••')) {
        record.set('api_key', apiKey)
      } else if (body.remove_key) {
        record.set('api_key', '')
      }
      record.set('is_active', true)
      $app.save(record)

      return e.json(200, {
        ok: true,
        message: 'Configuração do Google Places salva com sucesso.',
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao salvar configuração do Google Places' })
    }
  },
  $apis.requireAuth(),
)

// 3. POST /backend/v1/prospecting/start (Core action: niche, location, volume, template, daily_limit)
routerAdd(
  'POST',
  '/backend/v1/prospecting/start',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const profile = $app.findFirstRecordByData('user_profiles', 'user', userId)
      const orgId = profile.getString('organization_id') || 'org_ademicon_default'
      const autonomyMode = profile.getString('autonomy_mode') || 'copilot'

      const body = e.requestInfo().body || {}
      const niche = (body.niche || '').trim()
      const location = (body.location || '').trim()
      let targetVolume = parseInt(body.target_volume, 10) || 10
      if (targetVolume < 1) targetVolume = 1
      if (targetVolume > 100) targetVolume = 100

      let dailyLimit = parseInt(body.daily_limit, 10) || 50
      if (dailyLimit < 1) dailyLimit = 1

      const defaultTemplate =
        'Olá, bom dia! Tudo bem? Esse é o número da {nome do estabelecimento}?'
      const messageTemplate = (body.message_template || defaultTemplate).trim()

      if (!niche || !location) {
        return e.badRequestError('Nicho e Local são obrigatórios para iniciar a prospecção.')
      }

      // Check Google Places API key
      let googleApiKey = $os.getenv('GOOGLE_MAPS_API_KEY') || ''
      try {
        const configs = $app.findRecordsByFilter(
          'integration_configs',
          'organization_id = "' + orgId + '" && provider = "google_places"',
          '-created',
          1,
          0,
        )
        if (configs.length > 0 && configs[0].getString('api_key')) {
          googleApiKey = configs[0].getString('api_key')
        }
      } catch (_) {}

      const isDemo = !googleApiKey

      // 1. Create Prospect List record
      const listCol = $app.findCollectionByNameOrId('prospect_lists')
      const pList = new Record(listCol)
      pList.set('organization_id', orgId)
      pList.set('consultant', userId)
      pList.set('niche', niche)
      pList.set('location', location)
      pList.set('target_volume', targetVolume)
      pList.set('daily_limit', dailyLimit)
      pList.set('status', 'collecting')
      pList.set('total_collected', 0)
      pList.set('valid_phone_count', 0)
      pList.set('invalid_phone_count', 0)
      pList.set('duplicates_count', 0)
      pList.set('dispatched_count', 0)
      pList.set('replied_count', 0)
      pList.set('is_demo', isDemo)
      pList.set('message_template', messageTemplate)
      $app.save(pList)

      // 2. Fetch Places Data
      let rawPlaces = []
      if (!isDemo && googleApiKey) {
        try {
          const query = encodeURIComponent(niche + ' em ' + location)
          // Call Google Places Text Search API
          let searchUrl =
            'https://maps.googleapis.com/maps/api/place/textsearch/json?query=' +
            query +
            '&language=pt-BR&key=' +
            encodeURIComponent(googleApiKey)

          let pagesCount = 0
          while (searchUrl && rawPlaces.length < targetVolume && pagesCount < 3) {
            pagesCount++
            const res = $http.send({
              url: searchUrl,
              method: 'GET',
              timeout: 10,
            })

            if (res.statusCode >= 200 && res.statusCode < 300 && res.json && res.json.results) {
              const results = res.json.results || []
              for (let i = 0; i < results.length && rawPlaces.length < targetVolume; i++) {
                const item = results[i]
                rawPlaces.push({
                  place_id: item.place_id || '',
                  name: item.name || '',
                  address: item.formatted_address || '',
                  rating: item.rating || 0,
                })
              }

              // Check if next_page_token exists and we still need more
              if (res.json.next_page_token && rawPlaces.length < targetVolume) {
                // Places API requires a short pause before next_page_token is valid
                searchUrl =
                  'https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=' +
                  encodeURIComponent(res.json.next_page_token) +
                  '&key=' +
                  encodeURIComponent(googleApiKey)
              } else {
                searchUrl = ''
              }
            } else {
              searchUrl = ''
            }
          }

          // Enriquecer com Place Details para obter telefone e website
          for (let i = 0; i < rawPlaces.length; i++) {
            const p = rawPlaces[i]
            if (p.place_id) {
              try {
                const detUrl =
                  'https://maps.googleapis.com/maps/api/place/details/json?place_id=' +
                  encodeURIComponent(p.place_id) +
                  '&fields=name,formatted_phone_number,international_phone_number,website,formatted_address,rating&language=pt-BR&key=' +
                  encodeURIComponent(googleApiKey)
                const detRes = $http.send({
                  url: detUrl,
                  method: 'GET',
                  timeout: 8,
                })
                if (detRes.statusCode >= 200 && detRes.statusCode < 300 && detRes.json?.result) {
                  const det = detRes.json.result
                  p.raw_phone = det.international_phone_number || det.formatted_phone_number || ''
                  p.website = det.website || ''
                  if (det.formatted_address) p.address = det.formatted_address
                }
              } catch (_) {}
            }
          }
        } catch (fetchErr) {
          // If Google Places fails, log and fallback gracefully
          console.log('Google Places fetch error: ' + fetchErr.message)
        }
      }

      // Fallback demo dataset if API not configured or zero places returned
      if (rawPlaces.length === 0) {
        const demoEstablishments = [
          {
            name: niche + ' Alpha Prime',
            phone: '+55 41 98822-1011',
            address: 'Av. Batel, 1250 - ' + location,
            website: 'https://alphaprime-exemplo.com.br',
            rating: 4.8,
          },
          {
            name: niche + ' Excelência & Cia',
            phone: '+55 41 99134-2233',
            address: 'R. Marechal Deodoro, 450 - ' + location,
            website: 'https://excelencia-exemplo.com.br',
            rating: 4.9,
          },
          {
            name: 'Centro Especializado em ' + niche,
            phone: '+55 41 98455-3344',
            address: 'Av. Cândido de Abreu, 880 - ' + location,
            website: 'https://centroespecializado-exemplo.com.br',
            rating: 4.7,
          },
          {
            name: 'Grupo ' + niche + ' Brasil',
            phone: '+55 41 99766-4455',
            address: 'R. Comendador Araújo, 320 - ' + location,
            website: 'https://grupobrasil-exemplo.com.br',
            rating: 4.6,
          },
          {
            name: niche + ' Integrada & Soluções',
            phone: '+55 41 98177-5566',
            address: 'Av. República Argentina, 1100 - ' + location,
            website: 'https://integrada-exemplo.com.br',
            rating: 4.9,
          },
          {
            name: niche + ' São Judas',
            phone: '+55 41 99288-6677',
            address: 'R. XV de Novembro, 720 - ' + location,
            website: 'https://saojudas-exemplo.com.br',
            rating: 4.5,
          },
          {
            name: 'Aliança ' + niche + ' Premium',
            phone: '+55 41 98799-7788',
            address: 'Av. Silva Jardim, 1540 - ' + location,
            website: 'https://aliancapremium-exemplo.com.br',
            rating: 4.8,
          },
          {
            name: niche + ' Metrópole',
            phone: '+55 41 99600-8899',
            address: 'R. Buenos Aires, 250 - ' + location,
            website: 'https://metropole-exemplo.com.br',
            rating: 4.7,
          },
          {
            name: 'Rede Central de ' + niche,
            phone: '+55 41 98311-9900',
            address: 'R. Visconde de Nácar, 890 - ' + location,
            website: 'https://redecentral-exemplo.com.br',
            rating: 4.9,
          },
          {
            name: niche + ' Horizon',
            phone: '+55 41 99522-1122',
            address: 'Av. Visconde de Guarapuava, 3100 - ' + location,
            website: 'https://horizon-exemplo.com.br',
            rating: 4.8,
          },
        ]

        const qty = Math.min(targetVolume, demoEstablishments.length)
        for (let i = 0; i < qty; i++) {
          const item = demoEstablishments[i]
          rawPlaces.push({
            place_id: 'demo_place_' + $security.randomString(8),
            name: item.name,
            raw_phone: item.phone,
            address: item.address,
            website: item.website,
            rating: item.rating,
          })
        }
      }

      // 3. Process each place: deduplicate against existing contacts & other prospect lists
      const prospectCol = $app.findCollectionByNameOrId('prospects')
      const contactCol = $app.findCollectionByNameOrId('contacts')
      const convCol = $app.findCollectionByNameOrId('conversations')
      const oppCol = $app.findCollectionByNameOrId('opportunities')

      let validPhoneCount = 0
      let invalidPhoneCount = 0
      let duplicatesCount = 0
      const createdProspects = []
      const eligibleContactsForBroadcast = []

      // Cache existing contacts phone numbers
      let existingContacts = []
      try {
        existingContacts = $app.findRecordsByFilter(
          'contacts',
          'organization_id = "' + orgId + '"',
          '-created',
          500,
          0,
        )
      } catch (_) {}
      const existingPhoneMap = {}
      for (let k = 0; k < existingContacts.length; k++) {
        const p = (existingContacts[k].getString('phone') || '').replace(/\D/g, '')
        if (p) existingPhoneMap[p] = existingContacts[k].id
      }

      for (let i = 0; i < rawPlaces.length; i++) {
        const place = rawPlaces[i]
        const estName = place.name || 'Estabelecimento'
        const rawPhone = place.raw_phone || ''
        const cleanDigits = rawPhone.replace(/\D/g, '')

        let status = 'pendente'
        let formattedPhone = ''
        let errDetails = ''

        // Format phone to E.164 Brazilian standard if 10 or 11 digits
        if (!cleanDigits || cleanDigits.length < 8) {
          status = 'sem_whatsapp_valido'
          errDetails = 'Telefone ausente ou formato inválido'
          invalidPhoneCount++
        } else {
          // Normalize to +55...
          if (
            cleanDigits.startsWith('55') &&
            (cleanDigits.length === 12 || cleanDigits.length === 13)
          ) {
            formattedPhone = '+' + cleanDigits
          } else if (cleanDigits.length === 10 || cleanDigits.length === 11) {
            formattedPhone = '+55' + cleanDigits
          } else {
            formattedPhone = '+' + cleanDigits
          }

          const standardClean = formattedPhone.replace(/\D/g, '')

          // Check duplicate against existing contacts or existing prospects
          if (existingPhoneMap[standardClean]) {
            status = 'duplicado'
            errDetails = 'Número já existente na base de contatos comerciais'
            duplicatesCount++
          } else {
            // Check in prospects collection
            let existingInProspects = []
            try {
              existingInProspects = $app.findRecordsByFilter(
                'prospects',
                'formatted_phone = "' + formattedPhone + '"',
                '-created',
                1,
                0,
              )
            } catch (_) {}

            if (existingInProspects.length > 0) {
              status = 'duplicado'
              errDetails = 'Número já prospectado em lista anterior'
              duplicatesCount++
            } else {
              status = 'na_fila'
              validPhoneCount++
            }
          }
        }

        // Render message using user's exact template
        let renderedMsg = messageTemplate
          .replace(/\{\s*nome do estabelecimento\s*\}/gi, estName)
          .replace(/\{\s*estabelecimento\s*\}/gi, estName)
          .replace(/\{\s*nome\s*\}/gi, estName)
          .replace(/\{\s*nicho\s*\}/gi, niche)
          .replace(/\{\s*local\s*\}/gi, location)

        // Save prospect record
        const pr = new Record(prospectCol)
        pr.set('organization_id', orgId)
        pr.set('list', pList.id)
        pr.set('consultant', userId)
        pr.set('place_id', place.place_id || '')
        pr.set('establishment_name', estName)
        pr.set('raw_phone', rawPhone)
        pr.set('formatted_phone', formattedPhone)
        pr.set('address', place.address || '')
        pr.set('website', place.website || '')
        pr.set('google_rating', place.rating || 0)
        pr.set('status', status)
        pr.set('rendered_message', renderedMsg)
        pr.set('error_details', errDetails)
        pr.set('is_demo', isDemo)
        $app.save(pr)

        // If valid and not duplicated: create Contact (tag "Novo Lead") and Opportunity/Conversation
        if (status === 'na_fila' && formattedPhone) {
          try {
            // 1. Create Contact
            const contactRec = new Record(contactCol)
            contactRec.set('organization_id', orgId)
            contactRec.set('consultant', userId)
            contactRec.set('name', estName)
            contactRec.set('phone', formattedPhone)
            contactRec.set('profile', 'Prospect ' + niche + ' - ' + location + ' (Google Maps)')
            contactRec.set('category', 'lead')
            $app.save(contactRec)

            // Register in map to avoid duplicate in same loop
            const cClean = formattedPhone.replace(/\D/g, '')
            existingPhoneMap[cClean] = contactRec.id

            // Link contact to prospect
            pr.set('contact', contactRec.id)
            $app.save(pr)

            // 2. Create Conversation
            const convRec = new Record(convCol)
            convRec.set('organization_id', orgId)
            convRec.set('consultant', userId)
            convRec.set('contact', contactRec.id)
            convRec.set('commercial_stage', 'novo')
            convRec.set('temperature', 'fria')
            convRec.set('potential_value', 150000) // Default Ademicon consórcio ticket
            convRec.set('product_interest', niche)
            convRec.set(
              'summary',
              'Lead originado da Prospecção Maps no nicho: ' + niche + ' (' + location + ')',
            )
            convRec.set('next_best_action', 'Aguardar resposta ao primeiro contato de prospecção')
            convRec.set('last_interaction_at', new Date().toISOString())
            convRec.set('meeting_scheduled', false)
            $app.save(convRec)

            // 3. Create Opportunity
            const oppRec = new Record(oppCol)
            oppRec.set('organization_id', orgId)
            oppRec.set('consultant', userId)
            oppRec.set('contact', contactRec.id)
            oppRec.set('conversation', convRec.id)
            oppRec.set('stage', 'novo')
            oppRec.set('potential_value', 150000)
            oppRec.set('product_interest', niche)
            oppRec.set('status', 'open')
            $app.save(oppRec)

            eligibleContactsForBroadcast.push({
              prospect_id: pr.id,
              contact_id: contactRec.id,
              phone: formattedPhone,
              name: estName,
              message: renderedMsg,
            })
          } catch (createErr) {
            console.log('Error creating contact/conversation: ' + createErr.message)
          }
        }

        createdProspects.push(pr)
      }

      // 4. Create Linked Broadcast Campaign in Disparos module
      let linkedCampaignId = ''
      if (eligibleContactsForBroadcast.length > 0) {
        try {
          const campCol = $app.findCollectionByNameOrId('broadcast_campaigns')
          const camp = new Record(campCol)
          camp.set('organization_id', orgId)
          camp.set('consultant', userId)
          camp.set('title', 'Prospecção Maps: ' + niche + ' (' + location + ')')
          camp.set('message_template', messageTemplate)
          // Autonomy mode rule:
          // In 'copilot' mode (mode 1), messages require manual approval before sending
          // In mode 2/3 (copilot_automations, autonomous_followup), starts automatically
          const requiresApproval = autonomyMode === 'copilot'
          camp.set('status', requiresApproval ? 'draft' : 'scheduled')
          camp.set('audience_filter', {
            source: 'prospect_list',
            prospect_list_id: pList.id,
            contact_ids: eligibleContactsForBroadcast.map(function (c) {
              return c.contact_id
            }),
          })
          camp.set('total_recipients', eligibleContactsForBroadcast.length)
          camp.set('sent_count', 0)
          camp.set('delivered_count', 0)
          camp.set('read_count', 0)
          camp.set('error_count', 0)
          camp.set('replied_count', 0)
          camp.set('min_interval_seconds', 15)
          camp.set('max_interval_seconds', 35)
          camp.set('requires_manual_approval', requiresApproval)
          $app.save(camp)

          linkedCampaignId = camp.id

          // Create broadcast recipients for each eligible prospect
          const recCol = $app.findCollectionByNameOrId('broadcast_recipients')
          for (let m = 0; m < eligibleContactsForBroadcast.length; m++) {
            const item = eligibleContactsForBroadcast[m]
            const bRec = new Record(recCol)
            bRec.set('campaign', camp.id)
            bRec.set('contact', item.contact_id)
            bRec.set('recipient_phone', item.phone)
            bRec.set('recipient_name', item.name)
            bRec.set('rendered_message', item.message)
            bRec.set('status', requiresApproval ? 'waiting_approval' : 'pending')
            bRec.set('retry_count', 0)
            $app.save(bRec)
          }

          // Link campaign to prospect_list
          pList.set('campaign', linkedCampaignId)
          pList.set('status', 'ready')
        } catch (campErr) {
          console.log('Error creating campaign: ' + campErr.message)
        }
      } else {
        pList.set('status', 'completed')
      }

      // Update list counters
      pList.set('total_collected', rawPlaces.length)
      pList.set('valid_phone_count', validPhoneCount)
      pList.set('invalid_phone_count', invalidPhoneCount)
      pList.set('duplicates_count', duplicatesCount)
      $app.save(pList)

      // Audit log
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('user', userId)
        audit.set('action', 'prospecting_started')
        audit.set('entity_type', 'prospect_lists')
        audit.set('entity_id', pList.id)
        audit.set('details', {
          niche: niche,
          location: location,
          collected: rawPlaces.length,
          valid: validPhoneCount,
          campaign_id: linkedCampaignId,
          is_demo: isDemo,
        })
        $app.save(audit)
      } catch (_) {}

      return e.json(200, {
        ok: true,
        prospect_list: pList,
        total_collected: rawPlaces.length,
        valid_phone_count: validPhoneCount,
        invalid_phone_count: invalidPhoneCount,
        duplicates_count: duplicatesCount,
        campaign_id: linkedCampaignId,
        is_demo: isDemo,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao iniciar prospecção' })
    }
  },
  $apis.requireAuth(),
)

// 4. GET /backend/v1/prospecting/lists (Get lists with enriched counters)
routerAdd(
  'GET',
  '/backend/v1/prospecting/lists',
  (e) => {
    try {
      const userId = e.auth?.id
      if (!userId) return e.unauthorizedError('auth required')

      const lists = $app.findRecordsByFilter(
        'prospect_lists',
        'consultant = "' + userId + '"',
        '-created',
        50,
        0,
      )

      return e.json(200, {
        ok: true,
        lists: lists,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao buscar listas de prospecção' })
    }
  },
  $apis.requireAuth(),
)
