import { useEffect, useState, useRef } from 'react'
import {
  Sparkles,
  Send,
  MessageSquare,
  Filter,
  CheckCircle2,
  Clock,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  ShieldCheck,
  Bot,
  Loader2,
  User,
  ArrowRight,
  Edit2,
  HelpCircle,
  AlertCircle,
  Copy,
} from 'lucide-react'
import { useAuth } from '@/services/authContext'
import { copilotService } from '@/services/copilotService'
import pb from '@/lib/pocketbase/client'
import type { AiSuggestion, Conversation } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Copiloto() {
  const { user } = useAuth()
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string>('all')

  // Natural Language Chat with Native Agent
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: 'user' | 'agent'; text: string; timestamp: Date }>
  >([
    {
      sender: 'agent',
      text: 'Olá! Sou o seu Copiloto Comercial IA. Estou conectado à base de conhecimento oficial e às suas oportunidades ativas no WhatsApp. Pergunte sobre regras de produtos, como contornar objeções de clientes ou peça recomendações de próxima ação para um contato.',
      timestamp: new Date(),
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadData = async () => {
    if (!user) return
    try {
      const [suggs, convs] = await Promise.all([
        copilotService.getAiSuggestions(user.id),
        copilotService.getConversations(user.id),
      ])
      setSuggestions(suggs)
      setConversations(convs)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isAsking])

  // Filtered transcript suggestions
  const filteredSuggestions = suggestions.filter((s) => {
    if (selectedConvId === 'all') return true
    return s.conversation === selectedConvId
  })

  // Handle Natural Language query to Skip Cloud Native Agent
  const handleSendChat = async () => {
    if (!chatInput.trim() || isAsking) return
    const userQuery = chatInput.trim()
    setChatInput('')
    setChatMessages((prev) => [...prev, { sender: 'user', text: userQuery, timestamp: new Date() }])
    setIsAsking(true)

    try {
      const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/copilot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({
          message: userQuery,
          conversation_id: selectedConvId !== 'all' ? selectedConvId : null,
        }),
      })

      if (!res.ok) throw new Error('Falha ao comunicar com o agente')
      const data = await res.json()
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text:
            data.content ||
            'Não encontrei informação confiável suficiente para responder. Recomendo validação técnica.',
          timestamp: new Date(),
        },
      ])
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: 'Não encontrei informação confiável suficiente para responder. Recomendo validação técnica.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsAsking(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Texto copiado para a área de transferência!' })
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827] flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-[#4F46E5]" />
          Copiloto Comercial IA
        </h1>
        <p className="text-xs text-[#6B7280] mt-1">
          Chat estratégico com o agente comercial nativo e registro transparente de todas as
          próximas ações recomendadas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Natural Chat with the Agent (5 cols on lg) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-[#E5E7EB] flex flex-col h-[660px] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="pb-3 border-b border-[#E5E7EB] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#4F46E5] text-white flex items-center justify-center shadow-xs">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#111827] block">
                  Agente Comercial Skip Cloud
                </span>
                <span className="text-[10px] text-[#10B981] flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  Base de Conhecimento Ativa
                </span>
              </div>
            </div>

            <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">
              commercial-copilot
            </Badge>
          </div>

          {/* Quick Prompts strip */}
          <div className="py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-[#F3F4F6]">
            {[
              'Como contornar taxa de administração?',
              'Qual a regra para lance embutido?',
              'Como pedir horário para reunião?',
            ].map((p, i) => (
              <button
                key={i}
                onClick={() => setChatInput(p)}
                className="text-[10px] whitespace-nowrap bg-[#F9FAFB] hover:bg-[#EEF2FF] hover:text-[#4F46E5] text-[#4B5563] px-2.5 py-1 rounded-full border border-[#E5E7EB] transition-colors"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Messages body */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3 my-2 text-xs">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'p-3.5 rounded-2xl max-w-[88%] leading-relaxed text-xs shadow-xs space-y-1',
                  msg.sender === 'user'
                    ? 'ml-auto bg-[#4F46E5] text-white rounded-tr-sm'
                    : 'bg-[#F9FAFB] text-[#111827] border border-[#E5E7EB] rounded-tl-sm',
                )}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                <div
                  className={cn(
                    'text-[9px] flex justify-end',
                    msg.sender === 'user' ? 'text-indigo-200' : 'text-[#9CA3AF]',
                  )}
                >
                  {msg.timestamp.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
            {isAsking && (
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl text-xs text-[#6B7280] border border-[#E5E7EB]/60">
                <Loader2 className="w-4 h-4 animate-spin text-[#4F46E5]" />
                O Copiloto está consultando a base de conhecimento...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input */}
          <div className="pt-2 border-t border-[#E5E7EB] flex items-center gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSendChat()
                }
              }}
              placeholder="Digite sua dúvida comercial..."
              className="text-xs h-10 rounded-xl bg-[#F9FAFB]"
            />
            <Button
              onClick={handleSendChat}
              disabled={isAsking || !chatInput.trim()}
              className="h-10 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Right Column: Recommendations & Suggestions Feed (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white p-3.5 rounded-2xl border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center gap-2 text-xs text-[#374151]">
              <Filter className="w-3.5 h-3.5 text-[#6B7280]" />
              <span className="font-medium">Contexto da conversa:</span>
              <select
                value={selectedConvId}
                onChange={(e) => setSelectedConvId(e.target.value)}
                className="text-xs border border-[#D1D5DB] rounded-lg px-2.5 py-1 bg-white focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">Todas as conversas ativas</option>
                {conversations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.expand?.contact?.name || 'Cliente'} — R${' '}
                    {c.potential_value?.toLocaleString('pt-BR')} ({c.commercial_stage})
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-[#9CA3AF] font-medium">
              {filteredSuggestions.length} recomendações registradas
            </span>
          </div>

          <div className="space-y-3.5 max-h-[590px] overflow-y-auto pr-1">
            {filteredSuggestions.map((sugg) => (
              <div
                key={sugg.id}
                className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-3 text-xs"
              >
                {/* Header row: badge + date + confidence */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-semibold text-[#4F46E5] bg-[#EEF2FF]"
                    >
                      {sugg.type}
                    </Badge>
                    <span className="text-[11px] text-[#6B7280]">
                      {new Date(sugg.created).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#6B7280]">Confiança:</span>
                    <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#10B981] rounded-full"
                        style={{ width: `${Math.round((sugg.confidence || 0.8) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-[#111827]">
                      {Math.round((sugg.confidence || 0.8) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Próxima ação recomendada */}
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">
                    Próxima ação recomendada
                  </div>
                  <h4 className="text-xs font-bold text-[#111827]">{sugg.next_best_action}</h4>
                  <div className="mt-2 text-[11px] text-[#4B5563] bg-[#F9FAFB] p-3 rounded-xl border border-[#E5E7EB]/70 leading-relaxed">
                    <strong className="text-[#111827]">Justificativa operacional:</strong>{' '}
                    {sugg.reasoning_summary}
                  </div>
                </div>

                {/* Respostas sugeridas pela IA */}
                {sugg.suggested_response && sugg.suggested_response.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-semibold uppercase text-[#6B7280] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#4F46E5]" /> Respostas sugeridas:
                    </span>
                    {sugg.suggested_response.map((res, idx) => (
                      <div
                        key={idx}
                        className="group p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-[11px] text-[#374151] flex items-start justify-between gap-2"
                      >
                        <span className="italic leading-relaxed">{res}</span>
                        <button
                          onClick={() => copyToClipboard(res)}
                          title="Copiar texto"
                          className="text-[#9CA3AF] hover:text-[#4F46E5] opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Status + Actions (Aceitar / Ignorar / Adiar) */}
                <div className="pt-2 border-t border-[#F3F4F6] flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] capitalize',
                      sugg.status === 'accepted'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : sugg.status === 'ignored'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : sugg.status === 'deferred'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-50 text-[#6B7280]',
                    )}
                  >
                    Status: {sugg.status}
                  </Badge>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await copilotService.updateSuggestionStatus(sugg.id, 'accepted')
                        toast({ title: 'Sugestão aceita com sucesso!' })
                        loadData()
                      }}
                      className="h-7 text-[10px] text-[#10B981] hover:bg-emerald-50"
                    >
                      Aceitar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await copilotService.updateSuggestionStatus(sugg.id, 'deferred')
                        toast({ title: 'Sugestão adiada.' })
                        loadData()
                      }}
                      className="h-7 text-[10px] text-[#F59E0B] hover:bg-amber-50"
                    >
                      Adiar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await copilotService.updateSuggestionStatus(sugg.id, 'ignored')
                        toast({ title: 'Sugestão ignorada.' })
                        loadData()
                      }}
                      className="h-7 text-[10px] text-[#EF4444] hover:bg-rose-50"
                    >
                      Ignorar
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {filteredSuggestions.length === 0 && (
              <div className="text-center py-16 bg-white rounded-3xl border border-[#E5E7EB] text-xs text-[#9CA3AF]">
                Nenhuma sugestão registrada para o filtro selecionado.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
