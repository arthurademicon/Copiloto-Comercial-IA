import type {
  Contact,
  Conversation,
  Message,
  WhatsappInstance,
  WhatsappStatus,
  EvolutionConfigStatus,
} from '@/types'
import pb from '@/lib/pocketbase/client'

export interface ConnectResult {
  instance: WhatsappInstance
  qrcode?: string | null
  status: WhatsappStatus | 'waiting_qr'
  is_demo: boolean
  error?: string
}

export interface MessagingProviderAdapter {
  connectInstance(userId: string): Promise<ConnectResult>
  disconnectInstance(instanceId: string): Promise<boolean>
  getConnectionStatus(instanceId: string): Promise<WhatsappStatus>
  getProviderConfig(): Promise<EvolutionConfigStatus>
  saveProviderConfig(data: {
    base_url: string
    api_key?: string
    instance_name: string
  }): Promise<boolean>
  receiveMessage(payload: {
    conversationId: string
    contactId: string
    content: string
    providerEventId?: string
    metadata?: Record<string, unknown>
  }): Promise<Message>
  sendMessage(payload: {
    conversationId?: string
    contactId?: string
    phone?: string
    content: string
    metadata?: Record<string, unknown>
  }): Promise<Message>
  getContact(contactId: string): Promise<Contact | null>
  getConversation(conversationId: string): Promise<Conversation | null>
  markAsRead(conversationId: string): Promise<boolean>
  downloadMedia(mediaUrl: string): Promise<Blob | null>
}

class PluggableMessagingAdapterImpl implements MessagingProviderAdapter {
  async getProviderConfig(): Promise<EvolutionConfigStatus> {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/integrations/evolution/status`,
        {
          headers: {
            Authorization: pb.authStore.token,
          },
        },
      )
      if (res.ok) {
        return (await res.json()) as EvolutionConfigStatus
      }
    } catch {
      /* fallback */
    }
    return {
      is_configured: false,
      is_demo: true,
      base_url: '',
      instance_name: 'copiloto-ademicon',
      api_key_masked: '',
      has_api_key: false,
      live_status: 'disconnected',
      source: 'demo',
    }
  }

  async saveProviderConfig(data: {
    base_url: string
    api_key?: string
    instance_name: string
  }): Promise<boolean> {
    const res = await fetch(
      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/integrations/evolution/config`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify(data),
      },
    )
    return res.ok
  }

  async connectInstance(userId: string): Promise<ConnectResult> {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/integrations/evolution/connect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: pb.authStore.token,
          },
          body: JSON.stringify({ user_id: userId }),
        },
      )

      if (res.ok) {
        const data = await res.json()
        const isConnected = data.status === 'connected'
        await this.updateProfileStatus(userId, isConnected)

        let inst: WhatsappInstance
        try {
          inst = await pb
            .collection('whatsapp_instances')
            .getFirstListItem<WhatsappInstance>(`user="${userId}"`)
        } catch {
          inst = {
            id: 'wa_inst_' + Date.now(),
            user: userId,
            instance_name: data.instance_name || 'Instância WhatsApp',
            status: isConnected ? 'connected' : 'connecting',
            provider: data.is_demo ? 'demo' : 'evolution_api',
            is_demo: Boolean(data.is_demo),
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          }
        }

        return {
          instance: inst,
          qrcode: data.qrcode || null,
          status: data.status,
          is_demo: Boolean(data.is_demo),
          error: data.error,
        }
      }
    } catch {
      /* fallback to demo below */
    }

    // Demo fallback if network or config not available
    let existing: WhatsappInstance | null = null
    try {
      existing = await pb
        .collection('whatsapp_instances')
        .getFirstListItem<WhatsappInstance>(`user="${userId}"`)
    } catch {
      /* intentionally ignored */
    }

    if (existing) {
      const updated = await pb
        .collection('whatsapp_instances')
        .update<WhatsappInstance>(existing.id, {
          status: 'connected',
          is_demo: true,
          provider: 'demo',
        })
      await this.updateProfileStatus(userId, true)
      return { instance: updated, status: 'connected', is_demo: true }
    } else {
      const created = await pb.collection('whatsapp_instances').create<WhatsappInstance>({
        user: userId,
        instance_name: 'WhatsApp Demo',
        status: 'connected',
        provider: 'demo',
        provider_instance_id: `wa_demo_${Date.now()}`,
        is_demo: true,
      })
      await this.updateProfileStatus(userId, true)
      return { instance: created, status: 'connected', is_demo: true }
    }
  }

  async disconnectInstance(instanceId: string): Promise<boolean> {
    try {
      await fetch(
        `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/integrations/evolution/disconnect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: pb.authStore.token,
          },
        },
      )
    } catch {
      /* intentionally ignored */
    }

    try {
      const inst = await pb.collection('whatsapp_instances').getOne<WhatsappInstance>(instanceId)
      await pb.collection('whatsapp_instances').update(instanceId, {
        status: 'disconnected',
      })
      if (inst.user) {
        await this.updateProfileStatus(inst.user, false)
      }
      return true
    } catch {
      return false
    }
  }

  async getConnectionStatus(instanceId: string): Promise<WhatsappStatus> {
    try {
      const cfg = await this.getProviderConfig()
      if (cfg.is_configured && cfg.live_status) {
        return cfg.live_status
      }
      const inst = await pb.collection('whatsapp_instances').getOne<WhatsappInstance>(instanceId)
      return inst.status
    } catch {
      return 'disconnected'
    }
  }

  async receiveMessage(payload: {
    conversationId: string
    contactId: string
    content: string
    providerEventId?: string
    metadata?: Record<string, unknown>
  }): Promise<Message> {
    const userId = pb.authStore.record?.id || ''
    const providerEventId =
      payload.providerEventId || `demo_in_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    // Use idempotent backend ingest
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/messages/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify({
        conversation_id: payload.conversationId,
        contact_id: payload.contactId,
        direction: 'inbound',
        content: payload.content,
        provider_event_id: providerEventId,
        metadata: payload.metadata || {},
      }),
    })

    if (!res.ok) {
      return await pb.collection('messages').create<Message>({
        consultant: userId,
        conversation: payload.conversationId,
        contact: payload.contactId,
        direction: 'inbound',
        message_type: 'text',
        content: payload.content,
        timestamp: new Date().toISOString(),
        provider_event_id: providerEventId,
        metadata: payload.metadata || {},
      })
    }

    const data = await res.json()
    return data.message as Message
  }

  async sendMessage(payload: {
    conversationId?: string
    contactId?: string
    phone?: string
    content: string
    metadata?: Record<string, unknown>
  }): Promise<Message> {
    // Route via backend whatsapp/send hook which dynamically routes to Evolution API when configured,
    // or falls back to demo mode gracefully
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      const data = await res.json()
      return data.message as Message
    }

    // Direct fallback if hook offline
    const userId = pb.authStore.record?.id || ''
    const providerEventId = `out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    return await pb.collection('messages').create<Message>({
      consultant: userId,
      conversation: payload.conversationId || '',
      contact: payload.contactId || '',
      direction: 'outbound',
      message_type: 'text',
      content: payload.content,
      timestamp: new Date().toISOString(),
      provider_event_id: providerEventId,
      metadata: payload.metadata || {},
    })
  }

  async getContact(contactId: string): Promise<Contact | null> {
    try {
      return await pb.collection('contacts').getOne<Contact>(contactId)
    } catch {
      return null
    }
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      return await pb.collection('conversations').getOne<Conversation>(conversationId, {
        expand: 'contact,whatsapp_instance',
      })
    } catch {
      return null
    }
  }

  async markAsRead(_conversationId: string): Promise<boolean> {
    return true
  }

  async downloadMedia(_mediaUrl: string): Promise<Blob | null> {
    return null
  }

  private async updateProfileStatus(userId: string, connected: boolean) {
    try {
      const prof = await pb.collection('user_profiles').getFirstListItem(`user="${userId}"`)
      await pb.collection('user_profiles').update(prof.id, {
        whatsapp_connected: connected,
      })
    } catch {
      /* intentionally ignored */
    }
  }
}

// Single adapter instance exported — the rest of the application interacts only with this
export const messagingAdapter: MessagingProviderAdapter = new PluggableMessagingAdapterImpl()

// Demo Simulator: injects realistic inbound messages periodically (gated by is_demo = true)
const DEMO_SCRIPTS = [
  'Oi Arthur, vi o material que você mandou. Pode me explicar melhor como funciona o consórcio de imóvel na planta?',
  'Ainda estou avaliando a proposta com meu sócio, te retorno depois do dia 15.',
  'Isso me interessa sim. Você teria um horário essa semana pra conversarmos com calma?',
  'Arthur, conseguimos usar o FGTS como lance embutido nesse grupo?',
  'Bom dia! Gostei muito da projeção. Se fecharmos hoje, em quanto tempo participo da primeira assembleia?',
]

let simulatorTimer: ReturnType<typeof setInterval> | null = null

export function startDemoSimulator() {
  if (simulatorTimer) return

  simulatorTimer = setInterval(async () => {
    try {
      if (!pb.authStore.isValid || !pb.authStore.record) return
      const userId = pb.authStore.record.id

      // Verify if instance is demo and connected
      let instances: WhatsappInstance[] = []
      try {
        instances = await pb.collection('whatsapp_instances').getFullList<WhatsappInstance>({
          filter: `user="${userId}" && status="connected" && is_demo=true`,
        })
      } catch (_) {
        return
      }

      if (!instances || instances.length === 0) return

      // Pick a random conversation
      const convs = await pb.collection('conversations').getFullList<Conversation>({
        filter: `consultant="${userId}"`,
        sort: '-last_interaction_at',
      })
      if (!convs || convs.length === 0) return

      const targetConv = convs[Math.floor(Math.random() * convs.length)]
      const randomMsg = DEMO_SCRIPTS[Math.floor(Math.random() * DEMO_SCRIPTS.length)]

      await messagingAdapter.receiveMessage({
        conversationId: targetConv.id,
        contactId: targetConv.contact,
        content: randomMsg,
      })

      // Trigger copilot analysis after debounced message arrival
      try {
        await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/copilot/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: pb.authStore.token,
          },
          body: JSON.stringify({ conversation_id: targetConv.id }),
        })
      } catch {
        /* intentionally ignored */
      }
    } catch {
      /* intentionally ignored */
    }
  }, 75000)
}

export function stopDemoSimulator() {
  if (simulatorTimer) {
    clearInterval(simulatorTimer)
    simulatorTimer = null
  }
}
