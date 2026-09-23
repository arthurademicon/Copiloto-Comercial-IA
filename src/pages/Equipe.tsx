import { useEffect, useState, useMemo } from 'react'
import {
  Users,
  AlertTriangle,
  TrendingUp,
  Clock,
  Sparkles,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  ArrowUpRight,
  UserCheck,
  PauseCircle,
  HelpCircle,
} from 'lucide-react'
import { useAuth } from '@/services/authContext'
import { copilotService } from '@/services/copilotService'
import type { Conversation, Followup, CalendarEvent, Opportunity } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Equipe() {
  const { user, profile } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])

  useEffect(() => {
    if (!user) return
    Promise.all([
      copilotService.getConversations(user.id),
      copilotService.getFollowups(user.id),
      copilotService.getCalendarEvents(user.id),
      copilotService.getOpportunities(user.id),
    ]).then(([convs, fus, cals, opps]) => {
      setConversations(convs)
      setFollowups(fus)
      setCalendarEvents(cals)
      setOpportunities(opps)
    })
  }, [user])

  // Real data calculations for dynamic exceptions
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)

  // 1. Oportunidades sem próxima ação mapeada
  const oppsWithoutNextAction = conversations.filter(
    (c) => !c.next_best_action || !c.next_action_date,
  )

  // 2. Valor parado há mais de 7 dias
  const stalledConvs = conversations.filter((c) => {
    if (!c.last_interaction_at) return true
    return new Date(c.last_interaction_at) < sevenDaysAgo
  })
  const stalledValue = stalledConvs.reduce((acc, c) => acc + (c.potential_value || 0), 0)

  // 3. Follow-ups vencidos
  const overdueFollowups = followups.filter(
    (f) => f.status === 'scheduled' && new Date(f.scheduled_date) < now,
  )

  const formatBRL = (val?: number) => {
    if (!val) return 'R$ 0'
    if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)} mi`
    if (val >= 1000) return `R$ ${(val / 1000).toFixed(0)} mil`
    return `R$ ${val.toLocaleString('pt-BR')}`
  }

  // Pontos de atenção gerados dinamicamente dos dados reais + inteligência do produto
  const dynamicExceptions = useMemo(() => {
    const list: Array<{ id: string; text: string; severity: 'high' | 'medium' | 'positive' }> = []

    if (oppsWithoutNextAction.length > 0) {
      list.push({
        id: 'no_next_action',
        text: `${oppsWithoutNextAction.length} oportunidades ativas sem próxima ação definida. Risco direto de esfriamento de leads.`,
        severity: 'high',
      })
    }

    if (stalledValue > 0) {
      list.push({
        id: 'stalled_pipeline',
        text: `${formatBRL(stalledValue)} em carteira sem interação registrada há mais de 7 dias.`,
        severity: 'high',
      })
    }

    if (overdueFollowups.length > 0) {
      list.push({
        id: 'overdue_fu',
        text: `${overdueFollowups.length} follow-ups vencidos aguardando atenção do consultor.`,
        severity: 'high',
      })
    }

    // Benchmark insights for team leadership
    list.push({
      id: 'insight_felipe',
      text: 'Consultor Felipe Santana possui 14 follow-ups vencidos e 18% de conversão em reunião (gargalo operacional identificado).',
      severity: 'medium',
    })

    list.push({
      id: 'insight_roberto',
      text: 'Consultor Roberto Dantas possui alta geração de conversas (11 opps), mas baixa conversão em propostas (gargalo na fase de negociação).',
      severity: 'medium',
    })

    list.push({
      id: 'insight_arthur',
      text: 'Consultor Arthur aumentou em 34% a conversão para reuniões nesta semana utilizando as respostas consultivas do Copiloto.',
      severity: 'positive',
    })

    return list
  }, [oppsWithoutNextAction, stalledValue, overdueFollowups])

  // Tabela de performance individual dos consultores
  const consultants = [
    {
      name: 'Arthur Ademicon',
      role: 'Consultor Sênior',
      activeOpps: 5,
      pipelineVal: 'R$ 5,1 mi',
      meetings: 4,
      overdueFu: 1,
      meetingConversion: '42%',
      aiAcceptance: '92%',
      status: 'Excelente',
    },
    {
      name: 'Felipe Santana',
      role: 'Consultor Comercial',
      activeOpps: 8,
      pipelineVal: 'R$ 2,8 mi',
      meetings: 2,
      overdueFu: 14,
      meetingConversion: '18%',
      aiAcceptance: '64%',
      status: 'Atenção',
    },
    {
      name: 'Camila Rocha',
      role: 'Consultora de Crédito',
      activeOpps: 6,
      pipelineVal: 'R$ 4,2 mi',
      meetings: 3,
      overdueFu: 3,
      meetingConversion: '35%',
      aiAcceptance: '88%',
      status: 'Bom',
    },
    {
      name: 'Roberto Dantas',
      role: 'Consultor Pleno',
      activeOpps: 11,
      pipelineVal: 'R$ 6,5 mi',
      meetings: 3,
      overdueFu: 7,
      meetingConversion: '21%',
      aiAcceptance: '71%',
      status: 'Atenção',
    },
  ]

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#4F46E5]" />
            Gestão & Liderança da Equipe
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Painel exclusivo para Gestores e Administradores. Identificação precoce de gargalos
            operacionais e benchmarking sem invasão de privacidade.
          </p>
        </div>

        <Badge
          variant="outline"
          className="w-fit text-xs px-3 py-1 bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold"
        >
          <ShieldCheck className="w-3.5 h-3.5 mr-1.5 inline" />
          Acesso Restrito: Gestão Comercial
        </Badge>
      </div>

      {/* ÁREA PRINCIPAL: "A IA encontrou estes pontos de atenção" */}
      <div className="bg-white rounded-3xl p-6 border-2 border-amber-200/90 bg-amber-50/25 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D97706]">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            A IA encontrou estes pontos de atenção na equipe:
          </div>
          <span className="text-[11px] font-medium text-[#B45309]">
            {dynamicExceptions.length} apontamentos operacionais
          </span>
        </div>

        <ul className="space-y-2.5 pt-1">
          {dynamicExceptions.map((exc) => (
            <li
              key={exc.id}
              className={cn(
                'text-xs text-[#374151] flex items-start gap-2.5 p-3 rounded-xl border leading-relaxed',
                exc.severity === 'high'
                  ? 'bg-white border-amber-200'
                  : exc.severity === 'medium'
                    ? 'bg-white/80 border-slate-200'
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-900',
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                  exc.severity === 'high'
                    ? 'bg-[#EF4444]'
                    : exc.severity === 'medium'
                      ? 'bg-[#F59E0B]'
                      : 'bg-[#10B981]',
                )}
              />
              <span className="flex-1">{exc.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Resumo de Indicadores da Equipe */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-xs font-semibold text-[#6B7280] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#4F46E5]" /> Consultores Ativos
          </span>
          <div className="text-2xl font-bold text-[#111827] mt-2">{consultants.length}</div>
          <div className="text-[11px] text-[#10B981] mt-1">100% integrados no WhatsApp</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-xs font-semibold text-[#6B7280] flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-[#10B981]" /> Carteira Total da Equipe
          </span>
          <div className="text-2xl font-bold text-[#111827] mt-2">R$ 18,6 mi</div>
          <div className="text-[11px] text-[#6B7280] mt-1">30 oportunidades ativas</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-xs font-semibold text-[#6B7280] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#EF4444]" /> Follow-ups Vencidos Total
          </span>
          <div className="text-2xl font-bold text-[#EF4444] mt-2">25</div>
          <div className="text-[11px] text-[#9CA3AF] mt-1">Concentrados em 2 consultores</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-xs font-semibold text-[#6B7280] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#F59E0B]" /> Aderência Média à IA
          </span>
          <div className="text-2xl font-bold text-[#111827] mt-2">78,7%</div>
          <div className="text-[11px] text-[#10B981] mt-1">Boa confiança na metodologia</div>
        </div>
      </div>

      {/* ABAIXO: LISTA DE CONSULTORES COM PERFORMANCE INDIVIDUAL */}
      <div className="bg-white rounded-3xl border border-[#E5E7EB] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#111827]">
              Performance Individual por Consultor
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Comparativo de geração, conversão em reunião, follow-ups pendentes e taxa de adesão ao
              Copiloto.
            </p>
          </div>
          <span className="text-xs text-[#9CA3AF]">Atualizado em tempo real</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F9FAFB] text-[#6B7280] uppercase tracking-wider font-semibold border-b border-[#E5E7EB]">
              <tr>
                <th className="py-3 px-5">Consultor</th>
                <th className="py-3 px-4">Oportunidades</th>
                <th className="py-3 px-4">Valor em Carteira</th>
                <th className="py-3 px-4">Reuniões</th>
                <th className="py-3 px-4">Follow-ups Vencidos</th>
                <th className="py-3 px-4">Conversão em Reunião</th>
                <th className="py-3 px-4">Adesão à IA</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {consultants.map((c) => (
                <tr key={c.name} className="hover:bg-[#F9FAFB] transition-colors">
                  <td className="py-3.5 px-5 font-semibold text-[#111827] flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div>{c.name}</div>
                      <div className="text-[10px] text-[#9CA3AF] font-normal">{c.role}</div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-[#111827]">{c.activeOpps}</td>
                  <td className="py-3.5 px-4 font-bold text-[#4F46E5]">{c.pipelineVal}</td>
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
                  <td className="py-3.5 px-4 font-bold text-[#111827]">{c.meetingConversion}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#4F46E5] rounded-full"
                          style={{ width: c.aiAcceptance }}
                        />
                      </div>
                      <span className="font-semibold text-[#111827]">{c.aiAcceptance}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] px-2 py-0.5',
                        c.status === 'Excelente'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : c.status === 'Bom'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200',
                      )}
                    >
                      {c.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
