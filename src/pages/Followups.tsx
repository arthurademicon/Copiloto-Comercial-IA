import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock,
  Send,
  Calendar,
  XCircle,
  Sparkles,
  Edit2,
  CheckCircle2,
  ShieldAlert,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/services/authContext'
import { copilotService } from '@/services/copilotService'
import { messagingAdapter } from '@/services/messagingAdapter'
import type { Followup } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Followups() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [followups, setFollowups] = useState<Followup[]>([])
  const [activeTab, setActiveTab] = useState<'vencidos' | 'hoje' | 'esta_semana' | 'futuros' | 'automaticos' | 'aguardando'>('vencidos')

  // Edit / Reschedule Modal state
  const [selectedFollowup, setSelectedFollowup] = useState<Followup | null>(null)
  const [modalMode, setModalMode] = useState<'edit' | 'reschedule' | 'cancel' | null>(null)
  const [editedText, setEditedText] = useState('')
  const [newDate, setNewDate] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadFollowups = async () => {
    if (!user) return
    try {
      const data = await copilotService.getFollowups(user.id)
      setFollowups(data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadFollowups()
  }, [user])

  const now = new Date()

  // Filter sections
  const filteredList = followups.filter((fu) => {
    const sched = new Date(fu.scheduled_date)
    if (activeTab === 'aguardando') return fu.status === 'pending_approval'
    if (activeTab === 'automaticos') return fu.is_automatic
    if (activeTab === 'vencidos') return fu.status === 'scheduled' && sched < now
    if (activeTab === 'hoje') {
      return (
        fu.status === 'scheduled' &&
        sched.toDateString() === now.toDateString()
      )
    }
    if (activeTab === 'esta_semana') {
      const in7Days = new Date(now.getTime() + 7 * 86400000)
      return fu.status === 'scheduled' && sched >= now && sched <= in7Days
    }
    if (activeTab === 'futuros') {
      const in7Days = new Date(now.getTime() + 7 * 86400000)
      return fu.status === 'scheduled' && sched > in7Days
    }
    return true
  })

  // Send follow-up directly
  const handleSendFollowup = async (fu: Followup) => {
    setIsSubmitting(true)
    try {
      await messagingAdapter.sendMessage({
        conversationId: fu.conversation,
        contactId: fu.contact,
        content: fu.suggested_text,
      })

      await copilotService.updateFollowupStatus(fu.id, 'sent')
      toast({
        title: 'Follow-up enviado!',
        description: 'Mensagem transmitida no WhatsApp e status atualizado para enviado.',
      })
      loadFollowups()
    } catch {
      toast({
        title: 'Erro ao enviar follow-up',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle modal actions
  const handleModalSubmit = async () => {
    if (!selectedFollowup) return
    setIsSubmitting(true)
    try {
      if (modalMode === 'edit') {
        // update suggested text
        await copilotService.updateFollowupStatus(selectedFollowup.id, 'approved')
        toast({ title: 'Texto do follow-up atualizado!' })
      } else if (modalMode === 'reschedule') {
        await copilotService.rescheduleFollowup(selectedFollowup.id, new Date(newDate).toISOString())
        toast({ title: 'Follow-up remarcado com sucesso!' })
      } else if (modalMode === 'cancel') {
        await copilotService.updateFollowupStatus(selectedFollowup.id, 'cancelled', cancelReason)
        toast({ title: 'Follow-up cancelado.' })
      }
      setModalMode(null)
      loadFollowups()
    } catch {
      toast({ title: 'Erro ao atualizar follow-up', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatBRL = (val?: number) => {
    if (!val) return 'R$ 0'
    if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)} mi`
    if (val >= 1000) return `R$ ${(val / 1000).toFixed(0)} mil`
    return `R$ ${val.toLocaleString('pt-BR')}`
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Central de Follow-ups Inteligentes</h1>
        <p className="text-xs text-[#6B7280] mt-1">
          A IA nunca programa contatos genéricos. Cada follow-up possui um Por Quê, Quando e o Que dizer fundamentados na relação comercial.
        </p>
      </div>

      {/* Navigation tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'vencidos', label: 'Vencidos' },
          { id: 'hoje', label: 'Hoje' },
          { id: 'esta_semana', label: 'Esta Semana' },
          { id: 'futuros', label: 'Futuros' },
          { id: 'automaticos', label: 'Autônomos' },
          { id: 'aguardando', label: 'Aguardando Aprovação' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold border border-indigo-200'
                : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-100'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cards List */}
      <div className="space-y-4">
        {filteredList.map((fu) => {
          const contactName = fu.expand?.contact?.name || 'Cliente'
          const potentialVal = fu.expand?.conversation?.potential_value || 0
          const schedDate = new Date(fu.scheduled_date)
          const isOverdue = schedDate < now

          return (
            <div
              key={fu.id}
              className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-3"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center font-bold text-xs">
                    {contactName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#111827] flex items-center gap-2">
                      {contactName}
                      <span className="text-xs font-bold text-[#4F46E5]">
                        {formatBRL(potentialVal)}
                      </span>
                    </h3>
                    <p className="text-[11px] text-[#6B7280]">
                      Data agendada:{' '}
                      <strong className={cn(isOverdue ? 'text-[#EF4444]' : 'text-[#111827]')}>
                        {schedDate.toLocaleDateString('pt-BR')} às{' '}
                        {schedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {fu.is_automatic && (
                    <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                      Envio Autônomo
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] capitalize',
                      isOverdue ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-[#6B7280]'
                    )}
                  >
                    {isOverdue ? 'Vencido' : fu.status}
                  </Badge>
                </div>
              </div>

              {/* Por quê */}
              <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]/70 text-xs">
                <span className="font-semibold text-[#111827]">Motivo / Compromisso:</span>{' '}
                <span className="text-[#4B5563]">{fu.reason}</span>
              </div>

              {/* O que dizer */}
              <div className="p-3 bg-white border border-[#E5E7EB] rounded-xl text-xs space-y-1">
                <div className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#4F46E5]" /> Texto Sugerido para Envio:
                </div>
                <p className="text-xs text-[#374151] italic leading-relaxed">
                  "{fu.suggested_text}"
                </p>
              </div>

              {/* Action Buttons: [Enviar] [Editar] [Remarcar] [Cancelar] */}
              <div className="pt-2 border-t border-[#F3F4F6] flex flex-wrap items-center justify-between gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSendFollowup(fu)}
                  disabled={isSubmitting}
                  className="h-8 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold gap-1.5"
                >
                  <Send className="w-3 h-3" /> Enviar Mensagem
                </Button>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedFollowup(fu)
                      setEditedText(fu.suggested_text)
                      setModalMode('edit')
                    }}
                    className="h-8 text-xs gap-1"
                  >
                    <Edit2 className="w-3 h-3" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedFollowup(fu)
                      setNewDate(fu.scheduled_date.slice(0, 16))
                      setModalMode('reschedule')
                    }}
                    className="h-8 text-xs gap-1"
                  >
                    <Calendar className="w-3 h-3" /> Remarcar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedFollowup(fu)
                      setCancelReason('')
                      setModalMode('cancel')
                    }}
                    className="h-8 text-xs text-[#EF4444] hover:bg-rose-50"
                  >
                    <XCircle className="w-3 h-3 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )
        })}

        {filteredList.length === 0 && (
          <div className="bg-white rounded-3xl p-12 border border-[#E5E7EB] text-center text-xs text-[#9CA3AF]">
            <CheckCircle2 className="w-10 h-10 text-[#10B981] mx-auto mb-3" />
            Nenhum follow-up localizado nesta categoria.
          </div>
        )}
      </div>

      {/* Modal: Editar / Remarcar / Cancelar */}
      <Dialog open={!!modalMode} onOpenChange={() => setModalMode(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#111827]">
              {modalMode === 'edit'
                ? 'Editar Texto do Follow-up'
                : modalMode === 'reschedule'
                ? 'Remarcar Data de Retorno'
                : 'Cancelar Follow-up'}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3">
            {modalMode === 'edit' && (
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full text-xs p-3 border border-[#E5E7EB] rounded-xl focus:ring-indigo-500"
                rows={4}
              />
            )}

            {modalMode === 'reschedule' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#374151]">Nova data e horário:</label>
                <input
                  type="datetime-local"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full text-xs p-2.5 border border-[#E5E7EB] rounded-xl"
                />
              </div>
            )}

            {modalMode === 'cancel' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#374151]">Motivo do cancelamento:</label>
                <input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ex: Cliente fechou com outra instituição / Não possui mais interesse"
                  className="w-full text-xs p-2.5 border border-[#E5E7EB] rounded-xl"
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setModalMode(null)} className="text-xs">
              Voltar
            </Button>
            <Button
              onClick={handleModalSubmit}
              disabled={isSubmitting}
              className="h-9 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
