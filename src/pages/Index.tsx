import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock,
  Calendar,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  PhoneCall,
  CalendarDays,
  PauseCircle,
} from 'lucide-react'
import { useAuth } from '@/services/authContext'
import { copilotService } from '@/services/copilotService'
import type { Conversation, Followup, CalendarEvent, Opportunity } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function Index() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    if (!user) return
    try {
      const [convs, fus, cals, opps] = await Promise.all([
        copilotService.getConversations(user.id),
        copilotService.getFollowups(user.id),
        copilotService.getCalendarEvents(user.id),
        copilotService.getOpportunities(user.id),
      ])
      setConversations(convs)
      setFollowups(fus)
      setCalendarEvents(cals)
      setOpportunities(opps)
    } catch (e) {
      console.error('Error loading dashboard data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }, [])

  const firstName = (user?.name || 'Arthur').split(' ')[0]

  // Priority Actions calculation (Max 5)
  const priorityActions = useMemo(() => {
    const items: Array<{
      id: string
      clientName: string
      potentialValue: number
      label: string
      actionText: string
      type: 'followup' | 'meeting' | 'stalled'
      conversationId: string
      accentColor: string
      onClick: () => void
    }> = []

    // 1. Overdue or Today follow-ups
    const now = new Date()
    for (const fu of followups) {
      if (fu.status === 'scheduled' || fu.status === 'pending_approval') {
        const sched = new Date(fu.scheduled_date)
        const isOverdue = sched < now
        const contactName = fu.expand?.contact?.name || 'Cliente'
        const val = fu.expand?.conversation?.potential_value || 0

        items.push({
          id: `fu_${fu.id}`,
          clientName: contactName,
          potentialValue: val,
          label: isOverdue ? 'Follow-up vencido' : 'Follow-up agendado',
          actionText: 'Retomar',
          type: 'followup',
          conversationId: fu.conversation,
          accentColor: isOverdue ? 'border-l-[#EF4444]' : 'border-l-[#F59E0B]',
          onClick: () => navigate(`/conversas?conversation=${fu.conversation}`),
        })
      }
    }

    // 2. Advance to Meeting recommended conversations
    for (const conv of conversations) {
      if (
        conv.commercial_stage === 'reuniao' ||
        conv.next_best_action?.toLowerCase().includes('reunião')
      ) {
        const contactName = conv.expand?.contact?.name || 'Cliente'
        if (!items.find((i) => i.conversationId === conv.id)) {
          items.push({
            id: `conv_${conv.id}`,
            clientName: contactName,
            potentialValue: conv.potential_value || 0,
            label: 'Momento de reunião detectado',
            actionText: 'Agendar',
            type: 'meeting',
            conversationId: conv.id,
            accentColor: 'border-l-[#10B981]',
            onClick: () => navigate(`/conversas?conversation=${conv.id}&action=schedule`),
          })
        }
      }
    }

    // 3. Stalled opportunities without next action
    for (const conv of conversations) {
      if (!conv.next_best_action || !conv.next_action_date) {
        const contactName = conv.expand?.contact?.name || 'Cliente'
        if (!items.find((i) => i.conversationId === conv.id)) {
          items.push({
            id: `stalled_${conv.id}`,
            clientName: contactName,
            potentialValue: conv.potential_value || 0,
            label: 'Sem próxima ação definida',
            actionText: 'Responder',
            type: 'stalled',
            conversationId: conv.id,
            accentColor: 'border-l-[#F97316]',
            onClick: () => navigate(`/conversas?conversation=${conv.id}`),
          })
        }
      }
    }

    return items.slice(0, 5)
  }, [followups, conversations, navigate])

  // KPIs
  const overdueFollowupsCount = useMemo(() => {
    const now = new Date()
    return followups.filter((f) => f.status === 'scheduled' && new Date(f.scheduled_date) < now)
      .length
  }, [followups])

  const weekMeetingsCount = calendarEvents.length

  const stalledOpportunities = useMemo(() => {
    return conversations.filter((c) => !c.next_best_action || !c.next_action_date)
  }, [conversations])

  const stalledValue = useMemo(() => {
    return stalledOpportunities.reduce((acc, c) => acc + (c.potential_value || 0), 0)
  }, [stalledOpportunities])

  // Active Pipeline grouped by stage
  const pipelineStages: Array<{ stage: Conversation['commercial_stage']; label: string }> = [
    { stage: 'novo', label: 'Novo' },
    { stage: 'qualificacao', label: 'Qualificação' },
    { stage: 'oportunidade', label: 'Oportunidade' },
    { stage: 'reuniao', label: 'Reunião' },
    { stage: 'proposta', label: 'Proposta' },
    { stage: 'negociacao', label: 'Negociação' },
  ]

  const pipelineSummary = useMemo(() => {
    return pipelineStages.map((ps) => {
      const matching = conversations.filter((c) => c.commercial_stage === ps.stage)
      const sumVal = matching.reduce((acc, c) => acc + (c.potential_value || 0), 0)
      return {
        ...ps,
        count: matching.length,
        totalVal: sumVal,
      }
    })
  }, [conversations])

  const formatBRL = (val?: number) => {
    if (!val) return 'R$ 0'
    if (val >= 1000000) {
      return `R$ ${(val / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
    }
    if (val >= 1000) {
      return `R$ ${(val / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
    }
    return `R$ ${val.toLocaleString('pt-BR')}`
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* 1. Header Greetings & Priority Count */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            {greeting}, {firstName}.
          </h1>
          <p className="text-sm text-[#4B5563] mt-1 flex items-center gap-2">
            <span>Você tem</span>
            <Badge className="bg-[#4F46E5] text-white hover:bg-[#4338CA] px-2 py-0.5 rounded-full text-xs font-semibold">
              {priorityActions.length} ações prioritárias
            </Badge>
            <span>hoje para impulsionar suas vendas.</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => navigate('/conversas')}
            className="h-9 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-medium shadow-sm transition-all"
          >
            Abrir WhatsApp
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </div>

      {/* 2. Ações Prioritárias Cards (Top Section, Max 5) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            O que preciso fazer agora para vender?
          </h2>
          <span className="text-xs text-[#9CA3AF]">Ordenado por impacto comercial</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {priorityActions.map((action) => (
            <div
              key={action.id}
              className={`bg-white rounded-2xl p-4 border border-[#E5E7EB] border-l-4 ${action.accentColor} shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-md transition-all flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-tight text-[#6B7280]">
                    {action.label}
                  </span>
                  <span className="text-xs font-bold text-[#111827]">
                    {formatBRL(action.potentialValue)}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[#111827] truncate">
                  {action.clientName}
                </h3>
              </div>

              <div className="mt-4 pt-3 border-t border-[#F3F4F6] flex items-center justify-between">
                <span className="text-[11px] text-[#6B7280] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#4F46E5]" /> Sugestão da IA
                </span>
                <Button
                  size="sm"
                  onClick={action.onClick}
                  className="h-8 px-3 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-medium"
                >
                  {action.actionText}
                </Button>
              </div>
            </div>
          ))}

          {priorityActions.length === 0 && !loading && (
            <div className="col-span-full bg-white rounded-2xl p-8 border border-[#E5E7EB] text-center text-xs text-[#6B7280]">
              <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
              Nenhuma ação pendente no momento! Todas as oportunidades estão em dia.
            </div>
          )}
        </div>
      </div>

      {/* 3. KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="text-xs font-medium text-[#6B7280] flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#4F46E5]" /> Ações hoje
          </div>
          <div className="text-2xl font-bold text-[#111827] mt-1.5">{priorityActions.length}</div>
          <div className="text-[11px] text-[#9CA3AF] mt-0.5">Identificadas pelo copiloto</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="text-xs font-medium text-[#6B7280] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#EF4444]" /> Follow-ups vencidos
          </div>
          <div className="text-2xl font-bold text-[#EF4444] mt-1.5">{overdueFollowupsCount}</div>
          <div className="text-[11px] text-[#9CA3AF] mt-0.5">Requerem retorno imediato</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="text-xs font-medium text-[#6B7280] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#10B981]" /> Reuniões da semana
          </div>
          <div className="text-2xl font-bold text-[#10B981] mt-1.5">{weekMeetingsCount}</div>
          <div className="text-[11px] text-[#9CA3AF] mt-0.5">Na Google Agenda</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="text-xs font-medium text-[#6B7280] flex items-center gap-1.5">
            <PauseCircle className="w-3.5 h-3.5 text-[#F59E0B]" /> Oportunidades paradas
          </div>
          <div className="text-2xl font-bold text-[#F59E0B] mt-1.5">
            {stalledOpportunities.length}
          </div>
          <div className="text-[11px] text-[#9CA3AF] mt-0.5">
            Total de {formatBRL(stalledValue)}
          </div>
        </div>
      </div>

      {/* 4. Active Pipeline horizontal visualizer */}
      <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#111827]">Pipeline Comercial Ativo</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Distribuição de valor por estágio do funil
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/pipeline')}
            className="text-xs h-8 rounded-lg"
          >
            Ver Kanban Completo
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 pt-2">
          {pipelineSummary.map((item) => (
            <div
              key={item.stage}
              className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]/80 flex flex-col justify-between"
            >
              <div>
                <span className="text-[11px] font-semibold text-[#6B7280] block truncate">
                  {item.label}
                </span>
                <span className="text-base font-bold text-[#111827] mt-1 block">
                  {item.count} {item.count === 1 ? 'lead' : 'leads'}
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-[#E5E7EB] text-xs font-semibold text-[#4F46E5]">
                {formatBRL(item.totalVal)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Two Columns: Reuniões da semana & Oportunidades sem próxima ação */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Reuniões da semana */}
        <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#111827] flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#4F46E5]" />
              Reuniões da Semana
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/agenda')}
              className="text-xs h-7 text-[#4F46E5]"
            >
              Ver agenda
            </Button>
          </div>

          <div className="space-y-2.5">
            {calendarEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-[#111827]">{evt.title}</div>
                  <div className="text-[11px] text-[#6B7280] mt-0.5">
                    {new Date(evt.date).toLocaleDateString('pt-BR', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • {evt.meeting_type || 'Reunião Online'}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] bg-white">
                  Confirmada
                </Badge>
              </div>
            ))}

            {calendarEvents.length === 0 && (
              <div className="text-center py-6 text-xs text-[#9CA3AF]">
                Nenhuma reunião agendada para esta semana.
              </div>
            )}
          </div>
        </div>

        {/* Right: Oportunidades sem próxima ação */}
        <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#111827] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
              Oportunidades sem próxima ação
            </h3>
            <span className="text-xs text-[#9CA3AF]">Princípio Central IA</span>
          </div>

          <div className="space-y-2.5">
            {stalledOpportunities.map((conv) => (
              <div
                key={conv.id}
                className="p-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-[#111827]">
                    {conv.expand?.contact?.name || 'Cliente'}
                  </div>
                  <div className="text-[11px] text-[#EF4444] mt-0.5">
                    Estágio: {conv.commercial_stage} • {formatBRL(conv.potential_value)}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate(`/conversas?conversation=${conv.id}`)}
                  className="h-7 px-3 text-[11px] bg-white border border-[#D1D5DB] hover:bg-slate-50 text-[#111827]"
                >
                  Definir Ação
                </Button>
              </div>
            ))}

            {stalledOpportunities.length === 0 && (
              <div className="text-center py-6 text-xs text-[#10B981]">
                Excelente! 100% das suas oportunidades possuem próxima ação mapeada.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
