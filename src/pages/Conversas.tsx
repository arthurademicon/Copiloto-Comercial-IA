import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search,
  Sparkles,
  Send,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  Copy,
  ChevronDown,
  Check,
  RefreshCw,
  Clock,
  ShieldAlert,
  Flame,
  ArrowRight,
  User,
  Phone,
  HelpCircle,
  FileText,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/services/authContext'
import { copilotService } from '@/services/copilotService'
import { messagingAdapter } from '@/services/messagingAdapter'
import useRealtime from '@/hooks/use-realtime'
import type { Conversation, Message, AiSuggestion } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Conversas() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeConvIdFromUrl = searchParams.get('conversation')
  const shouldOpenScheduleModal = searchParams.get('action') === 'schedule'

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([])
  const [filterPill, setFilterPill] = useState('Todas')
  const [searchQuery, setSearchQuery] = useState('')

  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Feedback states
  const [feedbackDropdownId, setFeedbackDropdownId] = useState<string | null>(null)
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null)
  const [editedText, setEditedText] = useState('')

  // Meeting Schedule Modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Realtime subscription on messages, ai_suggestions, conversations
  useRealtime({
    collection: 'messages',
    onRecord: (record) => {
      const newMsg = record as Message
      if (activeConv && newMsg.conversation === activeConv.id) {
        setMessages((prev) => {
          if (
            prev.some((m) => m.id === newMsg.id || m.provider_event_id === newMsg.provider_event_id)
          ) {
            return prev
          }
          return [...prev, newMsg]
        })
      }
      // Update list preview
      loadConversations()
    },
  })

  useRealtime({
    collection: 'ai_suggestions',
    onRecord: (record) => {
      const newSugg = record as AiSuggestion
      if (activeConv && newSugg.conversation === activeConv.id) {
        setSuggestions((prev) => [newSugg, ...prev.filter((s) => s.id !== newSugg.id)])
      }
    },
  })

  // Load conversations
  const loadConversations = async () => {
    if (!user) return
    try {
      const convs = await copilotService.getConversations(user.id)
      setConversations(convs)

      if (!activeConv && convs.length > 0) {
        const target = activeConvIdFromUrl
          ? convs.find((c) => c.id === activeConvIdFromUrl) || convs[0]
          : convs[0]
        setActiveConv(target)
      } else if (activeConv) {
        const fresh = convs.find((c) => c.id === activeConv.id)
        if (fresh) setActiveConv(fresh)
      }
    } catch (e) {
      console.error('Failed to load conversations:', e)
    }
  }

  useEffect(() => {
    loadConversations()
  }, [user])

  // When active conversation changes, load its messages and suggestions
  useEffect(() => {
    if (!activeConv) return
    const loadDetails = async () => {
      try {
        const [msgs, suggs] = await Promise.all([
          copilotService.getMessages(activeConv.id),
          copilotService.getSuggestionsForConversation(activeConv.id),
        ])
        setMessages(msgs)
        setSuggestions(suggs)
        if (shouldOpenScheduleModal) {
          setScheduleModalOpen(true)
        }
      } catch (e) {
        console.error('Failed to load conv details:', e)
      }
    }
    loadDetails()
  }, [activeConv?.id, shouldOpenScheduleModal])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const contactName = c.expand?.contact?.name?.toLowerCase() || ''
    const phone = c.expand?.contact?.phone || ''
    const matchesSearch =
      contactName.includes(searchQuery.toLowerCase()) || phone.includes(searchQuery)

    if (!matchesSearch) return false

    if (filterPill === 'Oportunidades') return c.commercial_stage === 'oportunidade'
    if (filterPill === 'Follow-up')
      return c.commercial_stage === 'proposta' || c.next_best_action?.includes('Follow-up')
    if (filterPill === 'Reunião') return c.commercial_stage === 'reuniao'
    if (filterPill === 'Sem próxima ação') return !c.next_best_action || !c.next_action_date
    if (filterPill === 'Quentes') return c.temperature === 'quente'
    if (filterPill === 'Paradas') return !c.next_action_date

    return true
  })

  // Send message
  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeConv || isSending) return
    setIsSending(true)
    const content = inputText
    setInputText('')

    try {
      await messagingAdapter.sendMessage({
        conversationId: activeConv.id,
        contactId: activeConv.contact,
        content,
      })

      // Trigger debounced copilot analyze
      copilotService.triggerCopilotAnalysis(activeConv.id).catch(() => {})
    } catch {
      toast({
        title: 'Erro ao enviar mensagem',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  // Handle trigger AI analysis manually
  const handleRegenerateAnalysis = async () => {
    if (!activeConv || isAnalyzing) return
    setIsAnalyzing(true)
    try {
      await copilotService.triggerCopilotAnalysis(activeConv.id)
      const fresh = await copilotService.getSuggestionsForConversation(activeConv.id)
      setSuggestions(fresh)
      toast({
        title: 'Análise do Copiloto atualizada!',
        description: 'Novas sugestões geradas a partir do histórico mais recente.',
      })
    } catch {
      toast({
        title: 'Erro na análise da IA',
        variant: 'destructive',
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Handle AI suggestion actions
  const handleAcceptSuggestion = async (suggId: string, responseText?: string) => {
    await copilotService.updateSuggestionStatus(suggId, 'accepted')
    if (responseText) {
      setInputText(responseText.replace(/^[123]\.\s*(Consultiva|Direta|Investigativa):\s*/i, ''))
    }
    toast({
      title: 'Sugestão aceita!',
      description: 'Texto inserido no campo de mensagem.',
    })
    setSuggestions((prev) => prev.map((s) => (s.id === suggId ? { ...s, status: 'accepted' } : s)))
  }

  const handleIgnoreSuggestion = async (suggId: string, reason?: string) => {
    await copilotService.updateSuggestionStatus(suggId, 'ignored', reason)
    setFeedbackDropdownId(null)
    toast({
      title: 'Sugestão ignorada',
      description: 'Obrigado pelo feedback para calibração do modelo.',
    })
    setSuggestions((prev) => prev.map((s) => (s.id === suggId ? { ...s, status: 'ignored' } : s)))
  }

  const handleDeferSuggestion = async (suggId: string) => {
    await copilotService.updateSuggestionStatus(suggId, 'deferred')
    toast({
      title: 'Sugestão adiada',
      description: 'Você pode revisá-la a qualquer momento.',
    })
    setSuggestions((prev) => prev.map((s) => (s.id === suggId ? { ...s, status: 'deferred' } : s)))
  }

  // Availability slots for Google Calendar demo
  const demoSlots = [
    { id: 'slot1', label: 'Terça-feira às 15:00 (Amanhã)', text: 'terça às 15h' },
    { id: 'slot2', label: 'Quarta-feira às 10:00', text: 'quarta às 10h' },
    { id: 'slot3', label: 'Quinta-feira às 16:30', text: 'quinta às 16h30' },
  ]

  const handleConfirmSchedule = async () => {
    if (!activeConv || !selectedSlot) return
    const chosen = demoSlots.find((s) => s.id === selectedSlot)
    const generatedText = `Tenho terça às 15h ou quarta às 10h. Algum desses horários funciona para você?`
    setInputText(generatedText)

    try {
      await copilotService.createCalendarEvent({
        title: `Reunião com ${activeConv.expand?.contact?.name || 'Cliente'}`,
        conversation: activeConv.id,
        contact: activeConv.contact,
        date: new Date(Date.now() + 86400000 * 2).toISOString(),
        meeting_type: 'Google Meet',
      })
      await copilotService.updateConversationStage(activeConv.id, 'reuniao')
      toast({
        title: 'Horários gerados com sucesso!',
        description: 'Mensagem formatada e reunião pré-agendada no calendário.',
      })
    } catch {
      /* intentionally ignored */
    }

    setScheduleModalOpen(false)
  }

  const activeSuggestion = suggestions[0] || null

  const formatBRL = (val?: number) => {
    if (!val) return 'R$ 0'
    if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)} mi`
    if (val >= 1000) return `R$ ${(val / 1000).toFixed(0)} mil`
    return `R$ ${val.toLocaleString('pt-BR')}`
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden font-sans">
      {/* ================= COLUMN 1: CONVERSATION LIST (320px) ================= */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-[#E5E7EB] flex flex-col h-full z-10">
        {/* Search Header */}
        <div className="p-3 border-b border-[#E5E7EB] space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por contato ou telefone..."
              className="pl-9 h-9 text-xs rounded-xl border-[#E5E7EB] bg-[#F9FAFB]"
            />
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {[
              'Todas',
              'Oportunidades',
              'Follow-up',
              'Reunião',
              'Sem próxima ação',
              'Quentes',
              'Paradas',
            ].map((pill) => (
              <button
                key={pill}
                onClick={() => setFilterPill(pill)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition',
                  filterPill === pill
                    ? 'bg-[#4F46E5] text-white'
                    : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]',
                )}
              >
                {pill}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F3F4F6]">
          {filteredConversations.map((conv) => {
            const isSelected = activeConv?.id === conv.id
            const contactName = conv.expand?.contact?.name || 'Cliente'
            const phone = conv.expand?.contact?.phone || ''

            return (
              <div
                key={conv.id}
                onClick={() => {
                  setActiveConv(conv)
                  setSearchParams({ conversation: conv.id })
                }}
                className={cn(
                  'p-3 cursor-pointer transition-colors relative flex items-start gap-3',
                  isSelected
                    ? 'bg-[#EEF2FF]/60 border-l-4 border-l-[#4F46E5]'
                    : 'hover:bg-[#F9FAFB]',
                )}
              >
                <div className="w-9 h-9 rounded-full bg-[#E0E7FF] text-[#4F46E5] flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {contactName.slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-xs text-[#111827] truncate">
                      {contactName}
                    </span>
                    <span className="text-[10px] text-[#9CA3AF]">
                      {conv.last_interaction_at
                        ? new Date(conv.last_interaction_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#6B7280] truncate leading-tight">
                    {conv.summary || conv.next_best_action || phone}
                  </p>

                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 capitalize">
                      {conv.commercial_stage}
                    </Badge>
                    <span className="text-[10px] font-semibold text-[#111827]">
                      {formatBRL(conv.potential_value)}
                    </span>
                    {conv.temperature === 'quente' && (
                      <Flame className="w-3 h-3 text-[#EF4444] ml-auto" />
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {filteredConversations.length === 0 && (
            <div className="p-8 text-center text-xs text-[#9CA3AF]">
              Nenhuma conversa encontrada neste filtro.
            </div>
          )}
        </div>
      </div>

      {/* ================= COLUMN 2: MESSENGER CHAT (FLEXIBLE) ================= */}
      <div className="flex-1 flex flex-col bg-[#F7F7F8] min-w-0 border-r border-[#E5E7EB] h-full">
        {activeConv ? (
          <>
            {/* Chat Header */}
            <div className="h-14 px-4 bg-white border-b border-[#E5E7EB] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#4F46E5] font-semibold text-xs flex items-center justify-center">
                  {(activeConv.expand?.contact?.name || 'C').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#111827] flex items-center gap-2">
                    {activeConv.expand?.contact?.name}
                    <span className="text-[10px] text-[#10B981] font-normal flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] inline-block" />
                      WhatsApp Ativo
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6B7280]">
                    {activeConv.expand?.contact?.phone} •{' '}
                    {activeConv.product_interest || 'Consórcio / Crédito'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateAnalysis}
                  disabled={isAnalyzing}
                  className="h-8 text-xs gap-1.5"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', isAnalyzing && 'animate-spin')} />
                  Analisar IA
                </Button>
              </div>
            </div>

            {/* Chat Bubbles */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="text-center my-2">
                <span className="text-[10px] bg-slate-200/60 text-[#6B7280] px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold">
                  Hoje
                </span>
              </div>

              {messages.map((m) => {
                const isInbound = m.direction === 'inbound'
                return (
                  <div
                    key={m.id || m.provider_event_id}
                    className={cn(
                      'flex flex-col max-w-[75%]',
                      isInbound ? 'self-start items-start' : 'self-end items-end ml-auto',
                    )}
                  >
                    <div
                      className={cn(
                        'p-3 rounded-2xl text-xs leading-relaxed shadow-sm transition-all',
                        isInbound
                          ? 'bg-white text-[#111827] border border-[#E5E7EB] rounded-tl-sm'
                          : 'bg-[#4F46E5] text-white rounded-tr-sm',
                      )}
                    >
                      {m.content}
                    </div>
                    <span className="text-[10px] text-[#9CA3AF] mt-1 px-1">
                      {new Date(m.timestamp || m.created).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bottom */}
            <div className="p-3 bg-white border-t border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="Digite sua resposta no WhatsApp..."
                  className="h-10 text-xs rounded-xl border-[#E5E7EB] bg-[#F9FAFB] focus-visible:ring-indigo-500"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isSending || !inputText.trim()}
                  className="h-10 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-[#9CA3AF]">
            <Sparkles className="w-10 h-10 text-indigo-300 mb-2" />
            Selecione uma conversa ao lado para visualizar as mensagens e o Copiloto IA.
          </div>
        )}
      </div>

      {/* ================= COLUMN 3: COPILOTO IA PANEL (360px) ================= */}
      <div className="w-[360px] flex-shrink-0 bg-white flex flex-col h-full overflow-y-auto p-4 space-y-4">
        {activeConv ? (
          <>
            {/* Header: Contact details & Temperature */}
            <div className="p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#111827]">
                  {activeConv.expand?.contact?.name}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full capitalize',
                    activeConv.temperature === 'quente'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : activeConv.temperature === 'morna'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200',
                  )}
                >
                  <Flame className="w-2.5 h-2.5 mr-1 inline" />
                  {activeConv.temperature || 'fria'}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-[#E5E7EB]/70">
                <span className="text-[#6B7280]">Valor potencial:</span>
                <span className="font-bold text-[#111827]">
                  {formatBRL(activeConv.potential_value)}
                </span>
              </div>
            </div>

            {/* BLOCK: Próxima Melhor Ação */}
            <div className="p-4 rounded-2xl border-2 border-[#4F46E5]/30 bg-[#EEF2FF]/40 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#4F46E5] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Próxima Ação Recomendada
              </div>

              <div>
                <h4 className="text-xs font-bold text-[#111827] leading-snug">
                  {activeSuggestion?.next_best_action ||
                    activeConv.next_best_action ||
                    'Manter contato ativo'}
                </h4>
                <p className="text-[11px] text-[#4B5563] mt-1 leading-relaxed">
                  {activeSuggestion?.reasoning_summary ||
                    'Cliente demonstrou engajamento nas últimas interações.'}
                </p>
              </div>

              {/* Botão Principal Priorizado Visualmente */}
              {activeSuggestion?.meeting_recommended ||
              activeConv.commercial_stage === 'reuniao' ? (
                <div className="pt-1">
                  <div className="text-[11px] text-[#10B981] font-medium mb-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Momento recomendado para agendamento.
                  </div>
                  <Button
                    onClick={() => setScheduleModalOpen(true)}
                    className="w-full h-9 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold shadow-sm"
                  >
                    <Calendar className="w-3.5 h-3.5 mr-1.5" /> Convidar para Reunião
                  </Button>
                </div>
              ) : activeSuggestion?.follow_up_required ? (
                <Button
                  onClick={() => navigate('/followups')}
                  className="w-full h-9 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold"
                >
                  <Clock className="w-3.5 h-3.5 mr-1.5" /> Programar Follow-up
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    const firstSug = activeSuggestion?.suggested_response?.[0]
                    if (firstSug) {
                      setInputText(
                        firstSug.replace(/^[123]\.\s*(Consultiva|Direta|Investigativa):\s*/i, ''),
                      )
                    }
                  }}
                  className="w-full h-9 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Responder Agora
                </Button>
              )}
            </div>

            {/* BLOCK: Sugestões de Resposta (Até 3 rotuladas) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                  Sugestões de Resposta ({activeSuggestion?.suggested_response?.length || 0})
                </span>
                <span className="text-[10px] text-[#9CA3AF]">
                  Confiança: {Math.round((activeSuggestion?.confidence || 0.85) * 100)}%
                </span>
              </div>

              {activeSuggestion?.suggested_response?.map((sug, idx) => {
                const labelMatch = sug.match(
                  /^(1|2|3)?\.?\s*(Consultiva|Direta|Investigativa)?:\s*(.*)/i,
                )
                const styleName =
                  labelMatch?.[2] ||
                  (idx === 0 ? 'Consultiva' : idx === 1 ? 'Direta' : 'Investigativa')
                const cleanContent = labelMatch?.[3] || sug

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-semibold text-[#4F46E5] bg-[#EEF2FF]"
                      >
                        {idx + 1}. {styleName}
                      </Badge>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(cleanContent)
                            toast({ title: 'Copiado para a área de transferência!' })
                          }}
                          title="Copiar"
                          className="p-1 text-[#6B7280] hover:text-[#111827] rounded"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setInputText(cleanContent)}
                          title="Inserir no WhatsApp"
                          className="p-1 text-[#6B7280] hover:text-[#4F46E5] rounded font-medium text-[11px]"
                        >
                          Inserir
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#374151] leading-relaxed italic bg-[#F9FAFB] p-2 rounded-xl">
                      "{cleanContent}"
                    </p>

                    {/* Actions: Aceitar / Editar / Ignorar / Adiar */}
                    <div className="pt-2 border-t border-[#F3F4F6] flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAcceptSuggestion(activeSuggestion.id, cleanContent)}
                          className="h-6 px-2 text-[10px] text-[#10B981] hover:bg-emerald-50"
                        >
                          Aceitar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingSuggestionId(activeSuggestion.id)
                            setEditedText(cleanContent)
                          }}
                          className="h-6 px-2 text-[10px] text-[#6B7280] hover:bg-slate-100"
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeferSuggestion(activeSuggestion.id)}
                          className="h-6 px-2 text-[10px] text-[#6B7280] hover:bg-slate-100"
                        >
                          Adiar
                        </Button>
                      </div>

                      {/* Feedback Thumb Up / Down */}
                      <div className="flex items-center gap-1 relative">
                        <button
                          onClick={() => toast({ title: 'Obrigado pelo feedback positivo!' })}
                          className="p-1 text-[#9CA3AF] hover:text-[#10B981]"
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() =>
                            setFeedbackDropdownId(feedbackDropdownId ? null : activeSuggestion.id)
                          }
                          className="p-1 text-[#9CA3AF] hover:text-[#EF4444]"
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>

                        {/* Dropdown de Motivos ao dar 👎 */}
                        {feedbackDropdownId === activeSuggestion.id && (
                          <div className="absolute right-0 bottom-7 w-48 bg-white border border-[#E5E7EB] rounded-xl shadow-lg p-1.5 z-20 text-[11px] space-y-1">
                            <span className="text-[10px] text-[#9CA3AF] px-2 block font-medium">
                              Motivo:
                            </span>
                            {[
                              'Contexto errado',
                              'Muito cedo',
                              'Resposta artificial',
                              'Informação incorreta',
                              'Já resolvido',
                            ].map((reason) => (
                              <button
                                key={reason}
                                onClick={() => handleIgnoreSuggestion(activeSuggestion.id, reason)}
                                className="w-full text-left px-2 py-1 rounded hover:bg-slate-100 text-[#374151]"
                              >
                                {reason}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline edit textarea */}
                    {editingSuggestionId === activeSuggestion.id && (
                      <div className="pt-2 space-y-1.5">
                        <textarea
                          value={editedText}
                          onChange={(e) => setEditedText(e.target.value)}
                          className="w-full text-xs p-2 border border-[#E5E7EB] rounded-xl"
                          rows={2}
                        />
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingSuggestionId(null)}
                            className="h-6 text-[10px]"
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setInputText(editedText)
                              setEditingSuggestionId(null)
                            }}
                            className="h-6 text-[10px] bg-[#4F46E5] text-white"
                          >
                            Aplicar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* BLOCK: Resumo Comercial Accordion */}
            <Accordion
              type="single"
              collapsible
              className="w-full border border-[#E5E7EB] rounded-2xl p-2 bg-[#F9FAFB]"
            >
              <AccordionItem value="item-1" className="border-none">
                <AccordionTrigger className="text-xs font-semibold text-[#111827] py-2 px-2 hover:no-underline">
                  Resumo Comercial Estruturado
                </AccordionTrigger>
                <AccordionContent className="px-2 pt-2 space-y-2 text-xs text-[#4B5563]">
                  <div>
                    <span className="font-medium text-[#111827]">Objetivo:</span>{' '}
                    {activeConv.objective || 'Aquisição de imóvel/patrimônio'}
                  </div>
                  <div>
                    <span className="font-medium text-[#111827]">Urgência:</span>{' '}
                    {activeConv.urgency || 'Não informada'}
                  </div>
                  <div>
                    <span className="font-medium text-[#111827]">Principal dor:</span>{' '}
                    {activeConv.pain_point || 'Não mapeada'}
                  </div>
                  <div>
                    <span className="font-medium text-[#111827]">Estágio:</span>{' '}
                    {activeConv.commercial_stage}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </>
        ) : (
          <div className="text-center text-xs text-[#9CA3AF] my-auto">
            Selecione uma conversa para carregar o cérebro comercial da IA.
          </div>
        )}
      </div>

      {/* ================= MODAL: AGENDAR REUNIÃO GOOGLE AGENDA ================= */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#111827] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#4F46E5]" />
              Agendar Reunião Comercial
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-[#6B7280]">
              Horários livres consultados na sua agenda Google para{' '}
              <strong>{activeConv?.expand?.contact?.name}</strong>:
            </p>

            <div className="space-y-2">
              {demoSlots.map((slot) => (
                <div
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot.id)}
                  className={cn(
                    'p-3 rounded-2xl border cursor-pointer text-xs flex items-center justify-between transition-all',
                    selectedSlot === slot.id
                      ? 'border-[#4F46E5] bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                      : 'border-[#E5E7EB] hover:bg-slate-50 text-[#374151]',
                  )}
                >
                  <span>{slot.label}</span>
                  {selectedSlot === slot.id && <Check className="w-4 h-4 text-[#4F46E5]" />}
                </div>
              ))}
            </div>

            <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] text-[11px] text-[#6B7280] italic">
              "Tenho terça às 15h ou quarta às 10h. Algum desses horários funciona para você?"
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setScheduleModalOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmSchedule}
              disabled={!selectedSlot}
              className="h-9 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold"
            >
              Inserir no WhatsApp & Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
