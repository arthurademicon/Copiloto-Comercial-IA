import pb from '@/lib/pocketbase/client'
import type { ProspectList, Prospect, GooglePlacesConfig } from '@/types'

export const prospectingService = {
  // Obter status/configuração da API do Google Places (chave mascarada, demo flag)
  async getConfig(): Promise<GooglePlacesConfig> {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/prospecting/config`,
        {
          headers: {
            Authorization: pb.authStore.token,
          },
        },
      )
      if (res.ok) {
        return await res.json()
      }
    } catch {
      /* fallback */
    }
    return {
      has_api_key: false,
      api_key_masked: '',
      is_demo: true,
      source: 'demo',
    }
  },

  // Salvar chave da API do Google Places (restrito a gestores e admins)
  async saveConfig(payload: { apiKey?: string; removeKey?: boolean }): Promise<{
    ok: boolean
    message?: string
    error?: string
  }> {
    const res = await fetch(
      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/prospecting/config`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({
          api_key: payload.apiKey,
          remove_key: payload.removeKey,
        }),
      },
    )
    const data = await res.json()
    if (!res.ok) {
      return { ok: false, error: data.error || 'Erro ao salvar configuração do Google Places' }
    }
    return data
  },

  // Iniciar nova prospecção com os campos exatos do usuário
  async startProspecting(payload: {
    niche: string
    location: string
    target_volume: number
    daily_limit?: number
    message_template?: string
  }): Promise<{
    ok: boolean
    prospect_list?: ProspectList
    total_collected?: number
    valid_phone_count?: number
    invalid_phone_count?: number
    duplicates_count?: number
    campaign_id?: string
    is_demo?: boolean
    error?: string
  }> {
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/prospecting/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      return { ok: false, error: data.error || 'Erro ao iniciar prospecção' }
    }
    return data
  },

  // Buscar todas as listas de prospecção do usuário
  async getLists(): Promise<ProspectList[]> {
    return await pb.collection('prospect_lists').getFullList<ProspectList>({
      sort: '-created',
      expand: 'campaign',
    })
  },

  // Buscar detalhes de uma lista específica
  async getList(id: string): Promise<ProspectList> {
    return await pb.collection('prospect_lists').getOne<ProspectList>(id, {
      expand: 'campaign',
    })
  },

  // Buscar contatos/prospects de uma lista
  async getProspects(listId: string): Promise<Prospect[]> {
    return await pb.collection('prospects').getFullList<Prospect>({
      filter: `list="${listId}"`,
      sort: 'created',
      expand: 'contact',
    })
  },

  // Exportar lista em formato CSV estruturado para download
  exportCsv(list: ProspectList, prospects: Prospect[]): void {
    const headers = [
      'ID',
      'Estabelecimento',
      'Telefone',
      'Status',
      'Endereço',
      'Website',
      'Nota Google',
      'Mensagem Inicial',
      'Data Disparo',
      'Data Resposta',
      'Modo',
    ]

    const rows = prospects.map((p) => [
      p.id,
      `"${(p.establishment_name || '').replace(/"/g, '""')}"`,
      `"${p.formatted_phone || p.raw_phone || ''}"`,
      p.status,
      `"${(p.address || '').replace(/"/g, '""')}"`,
      `"${(p.website || '').replace(/"/g, '""')}"`,
      p.google_rating ?? '',
      `"${(p.rendered_message || '').replace(/"/g, '""')}"`,
      p.dispatched_at || '',
      p.replied_at || '',
      p.is_demo ? 'Demonstração' : 'Real',
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    const sanitizedTitle = `${list.niche}_${list.location}`.toLowerCase().replace(/[^a-z0-9]/g, '_')
    link.setAttribute('download', `prospeccao_${sanitizedTitle}_${list.id.slice(0, 6)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  },
}
