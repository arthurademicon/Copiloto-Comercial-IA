import pb from '@/lib/pocketbase/client'
import type { AiConfig } from '@/types'

export interface AvailableAiProvider {
  id: 'skip_agent' | 'openai' | 'anthropic' | 'custom_openrouter'
  name: string
  models: string[]
  description: string
}

export const aiProviderService = {
  async getConfig(): Promise<{
    config: AiConfig
    available_providers: AvailableAiProvider[]
  }> {
    try {
      const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/ai/config`, {
        headers: {
          Authorization: pb.authStore.token,
        },
      })
      if (res.ok) {
        return await res.json()
      }
    } catch {
      /* fallback */
    }

    return {
      config: {
        provider: 'skip_agent',
        model: 'commercial-copilot',
        temperature: 0.7,
        is_active: true,
      },
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
    }
  },

  async saveConfig(payload: {
    provider: string
    model: string
    temperature?: number
    api_key?: string
    custom_endpoint?: string
    system_prompt_override?: string
  }): Promise<{ ok: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/ai/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        return { ok: true, message: data.message }
      }
      return { ok: false, error: data.error || 'Erro ao salvar configurações de IA' }
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : 'Falha na requisição' }
    }
  },

  async sendChatMessage(payload: {
    message: string
    conversation_id?: string
  }): Promise<{ content: string; citations?: unknown[]; message_id?: string }> {
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/copilot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erro ao consultar Copiloto Comercial')
    }
    return await res.json()
  },
}
