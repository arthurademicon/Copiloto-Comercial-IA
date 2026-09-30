import pb from '@/lib/pocketbase/client'
import type { BroadcastCampaign, BroadcastRecipient } from '@/types'

export const broadcastService = {
  // List all campaigns for the consultant/org
  async getCampaigns(): Promise<BroadcastCampaign[]> {
    return await pb.collection('broadcast_campaigns').getFullList<BroadcastCampaign>({
      sort: '-created',
    })
  },

  // Get single campaign with recipients
  async getCampaign(id: string): Promise<BroadcastCampaign> {
    return await pb.collection('broadcast_campaigns').getOne<BroadcastCampaign>(id)
  },

  // Get recipients for a campaign
  async getRecipients(campaignId: string): Promise<BroadcastRecipient[]> {
    return await pb.collection('broadcast_recipients').getFullList<BroadcastRecipient>({
      filter: `campaign="${campaignId}"`,
      sort: 'created',
      expand: 'contact',
    })
  },

  // Create campaign through backend hook with audience resolution and throttling parameters
  async createCampaign(payload: {
    title: string
    message_template: string
    audience_filter?: {
      category?: string
      contact_ids?: string[]
    }
    scheduled_at?: string | null
    min_interval_seconds?: number
    max_interval_seconds?: number
    requires_manual_approval?: boolean
  }): Promise<{
    ok: boolean
    campaign?: BroadcastCampaign
    total_recipients?: number
    requires_manual_approval?: boolean
    error?: string
  }> {
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/broadcasts/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      return { ok: false, error: data.error || 'Erro ao criar campanha de disparo' }
    }
    return data
  },

  // Approve a single recipient or all waiting approval (Mode 1 Copilot human validation)
  async approveRecipients(payload: {
    campaign_id?: string
    recipient_id?: string
    approve_all?: boolean
  }): Promise<{ ok: boolean; approved_count?: number; error?: string }> {
    const res = await fetch(
      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/broadcasts/approve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify(payload),
      },
    )
    const data = await res.json()
    if (!res.ok) {
      return { ok: false, error: data.error || 'Erro ao aprovar disparos' }
    }
    return data
  },

  // Process next batch (throttled sending loop)
  async processNextBatch(campaignId: string): Promise<{
    ok: boolean
    processed?: number
    completed?: boolean
    waiting_approval?: boolean
    campaign_status?: string
    sent_count?: number
    error_count?: number
    message?: string
  }> {
    const res = await fetch(
      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/broadcasts/process-next`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      },
    )
    return await res.json()
  },

  // Pause / resume / cancel
  async updateStatus(
    campaignId: string,
    status: 'paused' | 'running' | 'cancelled',
  ): Promise<{ ok: boolean; status?: string }> {
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/broadcasts/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify({ campaign_id: campaignId, status }),
    })
    return await res.json()
  },
}
