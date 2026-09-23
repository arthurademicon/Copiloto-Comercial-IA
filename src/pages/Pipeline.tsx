import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Flame, ArrowRight, Clock, AlertTriangle, MoveRight } from 'lucide-react'
import { useAuth } from '@/services/authContext'
import { copilotService } from '@/services/copilotService'
import type { Conversation, CommercialStage } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const STAGES: Array<{ id: CommercialStage; title: string }> = [
  { id: 'novo', title: 'Novo' },
  { id: 'qualificacao', title: 'Qualificação' },
  { id: 'oportunidade', title: 'Oportunidade' },
  { id: 'reuniao', title: 'Reunião' },
  { id: 'proposta', title: 'Proposta' },
  { id: 'negociacao', title: 'Negociação' },
  { id: 'fechado', title: 'Fechado' },
  { id: 'perdido', title: 'Perdido' },
]

export default function Pipeline() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [draggedConvId, setDraggedConvId] = useState<string | null>(null)

  const loadData = async () => {
    if (!user) return
    try {
      const data = await copilotService.getConversations(user.id)
      setConversations(data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  const handleDragStart = (id: string) => {
    setDraggedConvId(id)
  }

  const handleDrop = async (newStage: CommercialStage) => {
    if (!draggedConvId) return
    const conv = conversations.find((c) => c.id === draggedConvId)
    if (!conv || conv.commercial_stage === newStage) {
      setDraggedConvId(null)
      return
    }

    // Optimistic UI update
    setConversations((prev) =>
      prev.map((c) => (c.id === draggedConvId ? { ...c, commercial_stage: newStage } : c)),
    )

    try {
      await copilotService.updateConversationStage(draggedConvId, newStage, 'Movido no Kanban')
      toast({
        title: 'Estágio comercial atualizado!',
        description: `Oportunidade movida para ${newStage}. Histórico registrado.`,
      })
    } catch {
      toast({
        title: 'Erro ao mover estágio',
        variant: 'destructive',
      })
      loadData()
    } finally {
      setDraggedConvId(null)
    }
  }

  const formatBRL = (val?: number) => {
    if (!val) return 'R$ 0'
    if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)} mi`
    if (val >= 1000) return `R$ ${(val / 1000).toFixed(0)} mil`
    return `R$ ${val.toLocaleString('pt-BR')}`
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            Pipeline de Vendas (Kanban)
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Arraste os cards entre as colunas para atualizar o estágio e gravar o histórico de
            eventos.
          </p>
        </div>
      </div>

      {/* Kanban Board Container with horizontal scroll */}
      <div className="flex gap-4 overflow-x-auto pb-6 min-h-[680px]">
        {STAGES.map((col) => {
          const colCards = conversations.filter((c) => c.commercial_stage === col.id)
          const colSum = colCards.reduce((acc, c) => acc + (c.potential_value || 0), 0)

          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.id)}
              className="w-72 flex-shrink-0 bg-[#F9FAFB] rounded-2xl p-3 border border-[#E5E7EB] flex flex-col justify-between"
            >
              <div>
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-[#111827]">{col.title}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {colCards.length}
                    </Badge>
                  </div>
                  <span className="text-[11px] font-bold text-[#4F46E5]">{formatBRL(colSum)}</span>
                </div>

                {/* Cards List */}
                <div className="space-y-3 pt-3">
                  {colCards.map((c) => {
                    const contactName = c.expand?.contact?.name || 'Cliente'
                    const hasAiAlert =
                      !c.next_best_action || !c.next_action_date || c.commercial_stage === 'reuniao'

                    return (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={() => handleDragStart(c.id)}
                        onClick={() => navigate(`/conversas?conversation=${c.id}`)}
                        className="p-3.5 bg-white rounded-xl border border-[#E5E7EB] shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-all space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#111827] truncate">
                            {contactName}
                          </span>
                          <span className="font-bold text-[#111827]">
                            {formatBRL(c.potential_value)}
                          </span>
                        </div>

                        {c.next_best_action && (
                          <div className="text-[11px] text-[#4B5563] line-clamp-2 bg-[#F9FAFB] p-1.5 rounded-lg border border-[#E5E7EB]/60">
                            <span className="font-medium text-[#111827]">Ação:</span>{' '}
                            {c.next_best_action}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 text-[10px] text-[#9CA3AF]">
                          <span>
                            {c.last_interaction_at
                              ? new Date(c.last_interaction_at).toLocaleDateString('pt-BR')
                              : 'Sem data'}
                          </span>

                          {hasAiAlert && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] px-1.5 py-0 border',
                                c.commercial_stage === 'reuniao'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200',
                              )}
                            >
                              <Sparkles className="w-2.5 h-2.5 mr-1 inline" />
                              {c.commercial_stage === 'reuniao'
                                ? 'Reunião Sugerida'
                                : 'Ação pendente'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {colCards.length === 0 && (
                    <div className="text-center py-10 text-[11px] text-[#9CA3AF] border-2 border-dashed border-[#E5E7EB] rounded-xl">
                      Arraste oportunidades aqui
                    </div>
                  )}
                </div>
              </div>

              {/* Column Footer */}
              <div className="pt-3 border-t border-[#E5E7EB]/60 mt-3 text-center">
                <span className="text-[10px] text-[#9CA3AF] block">
                  {colCards.length} {colCards.length === 1 ? 'oportunidade' : 'oportunidades'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
