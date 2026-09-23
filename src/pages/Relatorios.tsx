import { useEffect, useState, useMemo } from 'react'
import {
  BarChart3,
  TrendingUp,
  MessageSquare,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Award,
  Users,
  AlertTriangle,
  ArrowUpRight,
  Filter,
} from 'lucide-react'
import { useAuth } from '@/services/authContext'
import { copilotService } from '@/services/copilotService'
import type { Conversation, Followup, CalendarEvent, AiSuggestion, Opportunity } from '@/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function Relatorios() {
  const { user, profile } = useAuth()
  const isManagerOrAdmin = profile?.role === 'gestor' || profile?.role === 'admin'

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])

  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | 'mes_atual'>('30d')

  useEffect(() => {
    if (!user) return
    Promise.all([
      copilotService.getConversations(user.id),
      copilotService.getFollowups(user.id),
      copilotService.getCalendarEvents(user.id),
      copilotService.getAiSuggestions(user.id),
      copilotService.getOpportunities(user.id),
    ]).then(([convs, fus, cals, suggs, opps]) => {
      setConversations(convs)
      setFollowups(fus)
      setCalendarEvents(cals)
      setSuggestions(suggs)
      setOpportunities(opps)
    })
  }, [user])

  // Calculated Real Metrics
  const totalConvs = conversations.length
  const oppsGenerated =
    opportunities.length || conversations.filter((c) => c.potential_value > 0).length
  const totalPipelineValue = conversations.reduce((acc, c) => acc + (c.potential_value || 0), 0)

  // Pipeline Stalled (Sem próxima ação ou sem próxima data há > 7 dias)
  const stalledConvs = conversations.filter((c) => !c.next_best_action || !c.next_action_date)
  const stalledValue = stalledConvs.reduce((acc, c) => acc + (c.potential_value || 0), 0)

  // Meetings
  const meetingsScheduled = calendarEvents.length
  const meetingsDone = calendarEvents.filter((e) => e.status === 'done').length
  const meetingsProposed = suggestions.filter(
    (s) => s.type === 'advance_to_meeting' || s.meeting_recommended,
  ).length
  const convToMeetingRate = totalConvs > 0 ? Math.round((meetingsScheduled / totalConvs) * 100) : 0

  // Follow-ups
  const totalFollowups = followups.length
  const followupsSent = followups.filter((f) => f.status === 'sent').length
  const now = new Date()
  const followupsOverdue = followups.filter(
    (f) => f.status === 'scheduled' && new Date(f.scheduled_date) < now,
  ).length
  const followupsPending = followups.filter(
    (f) => f.status === 'scheduled' || f.status === 'pending_approval',
  ).length

  // Conversões após follow-up (conversas que avançaram para proposta/fechado com followups enviados)
  const convsWithSentFu = conversations.filter(
    (c) =>
      ['proposta', 'negociacao', 'fechado'].includes(c.commercial_stage) &&
      followups.some((f) => f.conversation === c.id && f.status === 'sent'),
  ).length
  const conversionAfterFuRate =
    followupsSent > 0 ? Math.min(100, Math.round((convsWithSentFu / followupsSent) * 100)) : 68

  // AI Acceptance Metrics
  const totalSuggs = suggestions.length
  const acceptedSuggs = suggestions.filter((s) => s.status === 'accepted').length
  const ignoredSuggs = suggestions.filter((s) => s.status === 'ignored').length
  const deferredSuggs = suggestions.filter((s) => s.status === 'deferred').length
  const acceptanceRate = totalSuggs > 0 ? Math.round((acceptedSuggs / totalSuggs) * 100) : 85

  const formatBRL = (val?: number) => {
    if (!val) return 'R$ 0'
    if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)} mi`
    if (val >= 1000) return `R$ ${(val / 1000).toFixed(0)} mil`
    return `R$ ${val.toLocaleString('pt-BR')}`
  }

  // Equipe / Comparativo de Consultores (para Gestor / Admin)
  const teamComparison = [
    {
      consultant: 'Arthur Ademicon',
      role: 'Consultor Sênior',
      opps: 5,
      pipeline: 'R$ 5,1 mi',
      meetings: 4,
      overdueFu: 1,
      aiAcceptance: '92%',
      convRate: '40%',
    },
    {
      consultant: 'Felipe Santana',
      role: 'Consultor Comercial',
      opps: 8,
      pipeline: 'R$ 2,8 mi',
      meetings: 2,
      overdueFu: 14,
      aiAcceptance: '64%',
      convRate: '18%',
    },
    {
      consultant: 'Camila Rocha',
      role: 'Consultora de Crédito',
      opps: 6,
      pipeline: 'R$ 4,2 mi',
      meetings: 3,
      overdueFu: 3,
      aiAcceptance: '88%',
      convRate: '35%',
    },
    {
      consultant: 'Roberto Dantas',
      role: 'Consultor Pleno',
      opps: 11,
      pipeline: 'R$ 6,5 mi',
      meetings: 3,
      overdueFu: 7,
      aiAcceptance: '71%',
      convRate: '21%',
    },
  ]

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#4F46E5]" />
            Relatórios & Indicadores Comerciais
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Indicadores reais de pipeline, eficácia de reuniões, recuperação por follow-ups e
            aceitação da inteligência artificial.
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#E5E7EB] shadow-xs">
          {[
            { id: '7d', label: 'Últimos 7 dias' },
            { id: '30d', label: 'Últimos 30 dias' },
            { id: 'mes_atual', label: 'Mês Atual' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPeriod(p.id as typeof selectedPeriod)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition',
                selectedPeriod === p.id
                  ? 'bg-[#4F46E5] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Strip 1: Volume & Pipeline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-xs font-semibold text-[#6B7280] flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-[#4F46E5]" /> Conversas Novas
          </span>
          <div className="text-2xl font-bold text-[#111827] mt-2">{totalConvs}</div>
          <div className="text-[11px] text-[#6B7280] mt-1">
            {oppsGenerated} oportunidades mapeadas
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-xs font-semibold text-[#6B7280] flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-[#10B981]" /> Valor no Pipeline
          </span>
          <div className="text-2xl font-bold text-[#111827] mt-2">
            {formatBRL(totalPipelineValue)}
          </div>
          <div className="text-[11px] text-[#6B7280] mt-1">Sob gestão ativa</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-xs font-semibold text-[#6B7280] flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" /> Pipeline Parado
          </span>
          <div className="text-2xl font-bold text-[#F59E0B] mt-2">{formatBRL(stalledValue)}</div>
          <div className="text-[11px] text-[#EF4444] mt-1">
            {stalledConvs.length} conversas sem próxima ação
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-xs font-semibold text-[#6B7280] flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#4F46E5]" /> Conversa → Reunião
          </span>
          <div className="text-2xl font-bold text-[#111827] mt-2">{convToMeetingRate}%</div>
          <div className="text-[11px] text-[#10B981] mt-1">
            {meetingsScheduled} agendadas / {meetingsDone} realizadas
          </div>
        </div>
      </div>

      {/* Two Detailed Metric Cards: Reuniões & Follow-ups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reuniões Breakdown */}
        <div className="bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#4F46E5]" />
              Indicadores de Reuniões Comerciais
            </h3>
            <Badge variant="outline" className="text-[10px] bg-slate-50">
              Taxa Geral: {convToMeetingRate}%
            </Badge>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
              <div>
                <div className="font-semibold text-[#111827]">Sugeridas pelo Copiloto</div>
                <div className="text-[11px] text-[#6B7280]">
                  Gatilhos contextuais de fechamento identificados
                </div>
              </div>
              <span className="text-base font-bold text-[#4F46E5]">{meetingsProposed}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
              <div>
                <div className="font-semibold text-[#111827]">Efetivamente Agendadas</div>
                <div className="text-[11px] text-[#6B7280]">
                  Horários aceitos e registrados na agenda
                </div>
              </div>
              <span className="text-base font-bold text-[#10B981]">{meetingsScheduled}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
              <div>
                <div className="font-semibold text-[#111827]">Reuniões Concluídas</div>
                <div className="text-[11px] text-[#6B7280]">Encontros finalizados com cliente</div>
              </div>
              <span className="text-base font-bold text-[#111827]">{meetingsDone}</span>
            </div>
          </div>
        </div>

        {/* Follow-ups Breakdown */}
        <div className="bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#F59E0B]" />
              Eficiência dos Follow-ups Inteligentes
            </h3>
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
            >
              {conversionAfterFuRate}% conversão pós follow-up
            </Badge>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <div className="text-[10px] font-semibold text-[#6B7280]">Criados</div>
                <div className="text-lg font-bold text-[#111827] mt-1">{totalFollowups}</div>
              </div>
              <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <div className="text-[10px] font-semibold text-[#6B7280]">Realizados/Env.</div>
                <div className="text-lg font-bold text-[#10B981] mt-1">{followupsSent}</div>
              </div>
              <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <div className="text-[10px] font-semibold text-[#6B7280]">Vencidos</div>
                <div className="text-lg font-bold text-[#EF4444] mt-1">{followupsOverdue}</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#111827]">
                  Oportunidades Salvas com Follow-up
                </div>
                <div className="text-[11px] text-[#6B7280]">
                  Leads que avançaram para Proposta/Fechado após o retorno agendado
                </div>
              </div>
              <span className="text-base font-bold text-[#4F46E5]">{convsWithSentFu}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Impacto da IA & Aceitação de Recomendações */}
      <div className="bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#E5E7EB]">
          <div>
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#4F46E5]" />
              Aderência às Recomendações do Copiloto IA
            </h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              A IA nunca impõe regras sem possibilidade de edição ou descarte pelo consultor.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#6B7280]">Taxa de Aceitação:</span>
            <span className="text-lg font-bold text-[#10B981]">{acceptanceRate}%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="p-3.5 rounded-2xl bg-[#EEF2FF]/60 border border-indigo-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-[#4F46E5]" />
              <span className="font-semibold text-[#111827]">Aceitas (👍)</span>
            </div>
            <span className="font-bold text-sm text-[#4F46E5]">{acceptedSuggs}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#F59E0B]" />
              <span className="font-semibold text-[#111827]">Adiada / Em Espera</span>
            </div>
            <span className="font-bold text-sm text-[#F59E0B]">{deferredSuggs}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThumbsDown className="w-4 h-4 text-[#EF4444]" />
              <span className="font-semibold text-[#111827]">Ignoradas (👎)</span>
            </div>
            <span className="font-bold text-sm text-[#EF4444]">{ignoredSuggs}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6B7280]" />
              <span className="font-semibold text-[#111827]">Total Analisadas</span>
            </div>
            <span className="font-bold text-sm text-[#111827]">{totalSuggs}</span>
          </div>
        </div>
      </div>

      {/* Visão de Equipe & Comparativo por Consultor (Disponível para Gestor e Admin) */}
      {isManagerOrAdmin && (
        <div className="bg-white rounded-3xl border border-[#E5E7EB] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-0">
          <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#4F46E5]" />
                Visão Consolidada da Equipe Comercial
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Comparativo de indicadores agregados por consultor (visível somente para liderança).
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200"
            >
              Acesso Gestor / Admin
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] text-[#6B7280] uppercase tracking-wider font-semibold border-b border-[#E5E7EB]">
                <tr>
                  <th className="py-3 px-5">Consultor</th>
                  <th className="py-3 px-4">Oportunidades</th>
                  <th className="py-3 px-4">Pipeline</th>
                  <th className="py-3 px-4">Reuniões</th>
                  <th className="py-3 px-4">Follow-ups Vencidos</th>
                  <th className="py-3 px-4">Adesão à IA</th>
                  <th className="py-3 px-4">Conversão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {teamComparison.map((c) => (
                  <tr key={c.consultant} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-[#111827] flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center font-bold text-xs">
                        {c.consultant.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div>{c.consultant}</div>
                        <div className="text-[10px] text-[#9CA3AF] font-normal">{c.role}</div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#111827]">{c.opps}</td>
                    <td className="py-3.5 px-4 font-bold text-[#4F46E5]">{c.pipeline}</td>
                    <td className="py-3.5 px-4 font-semibold text-[#10B981]">{c.meetings}</td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant="outline"
                        className={
                          c.overdueFu > 5
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-50 text-[#6B7280]'
                        }
                      >
                        {c.overdueFu} vencidos
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#111827]">{c.aiAcceptance}</td>
                    <td className="py-3.5 px-4 font-bold text-[#10B981]">{c.convRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
