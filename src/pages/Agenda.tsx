import { useEffect, useState, useMemo } from 'react'
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  Video,
  List,
  CalendarDays,
  CheckSquare,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { useAuth } from '@/services/authContext'
import { copilotService } from '@/services/copilotService'
import type { CalendarEvent, CommercialTask, Followup } from '@/types'
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

type UnifiedItem = {
  id: string
  sourceType: 'meeting' | 'task' | 'followup'
  title: string
  date: Date
  status: string
  detail?: string
  contactName?: string
  original: CalendarEvent | CommercialTask | Followup
}

export default function Agenda() {
  const { user } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<CommercialTask[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])

  const [viewMode, setViewMode] = useState<'semana' | 'dia'>('semana')
  const [filterType, setFilterType] = useState<'todos' | 'reunioes' | 'tarefas' | 'followups'>(
    'todos',
  )
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // Modal states
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null)
  const [newEventModalOpen, setNewEventModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newType, setNewType] = useState('Google Meet')

  const loadAll = async () => {
    if (!user) return
    try {
      const [evts, tsks, fus] = await Promise.all([
        copilotService.getCalendarEvents(user.id),
        copilotService.getTasks(user.id),
        copilotService.getFollowups(user.id),
      ])
      setEvents(evts)
      setTasks(tsks)
      setFollowups(fus)
    } catch (e) {
      console.error('Error loading agenda data:', e)
    }
  }

  useEffect(() => {
    loadAll()
  }, [user])

  // Combine calendar_events, tasks with due_date, and followups with scheduled_date
  const unifiedItems: UnifiedItem[] = useMemo(() => {
    const list: UnifiedItem[] = []

    // 1. Calendar Events (Reuniões)
    events.forEach((evt) => {
      list.push({
        id: `evt_${evt.id}`,
        sourceType: 'meeting',
        title: evt.title,
        date: new Date(evt.date),
        status: evt.status,
        detail: evt.meeting_type || 'Google Meet',
        contactName: evt.expand?.contact?.name,
        original: evt,
      })
    })

    // 2. Commercial Tasks with due_date
    tasks.forEach((t) => {
      if (t.due_date) {
        list.push({
          id: `tsk_${t.id}`,
          sourceType: 'task',
          title: t.title,
          date: new Date(t.due_date),
          status: t.status,
          detail: t.description,
          original: t,
        })
      }
    })

    // 3. Follow-ups with scheduled_date
    followups.forEach((fu) => {
      if (fu.scheduled_date) {
        list.push({
          id: `fu_${fu.id}`,
          sourceType: 'followup',
          title: `Follow-up: ${fu.expand?.contact?.name || 'Cliente'}`,
          date: new Date(fu.scheduled_date),
          status: fu.status,
          detail: fu.reason,
          contactName: fu.expand?.contact?.name,
          original: fu,
        })
      }
    })

    return list.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [events, tasks, followups])

  // Filtered by item type
  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      if (filterType === 'reunioes') return item.sourceType === 'meeting'
      if (filterType === 'tarefas') return item.sourceType === 'task'
      if (filterType === 'followups') return item.sourceType === 'followup'
      return true
    })
  }, [unifiedItems, filterType])

  // Calculate current week boundaries
  const weekDays = useMemo(() => {
    const curr = new Date(selectedDate)
    const day = curr.getDay()
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
    const monday = new Date(curr.setDate(diff))

    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }, [selectedDate])

  const handlePrevWeek = () => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() - 7)
    setSelectedDate(next)
  }

  const handleNextWeek = () => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 7)
    setSelectedDate(next)
  }

  const handleToday = () => {
    setSelectedDate(new Date())
  }

  const handleCreateEvent = async () => {
    if (!newTitle.trim() || !newDate) return
    try {
      await copilotService.createCalendarEvent({
        title: newTitle,
        date: new Date(newDate).toISOString(),
        meeting_type: newType,
      })
      toast({
        title: 'Reunião criada na agenda!',
        description: 'Gravada no sistema interno com id de referência do calendário.',
      })
      setNewEventModalOpen(false)
      setNewTitle('')
      setNewDate('')
      loadAll()
    } catch {
      toast({ title: 'Erro ao criar reunião', variant: 'destructive' })
    }
  }

  const daysLabel = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-[#4F46E5]" />
            Agenda do Consultor
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Visão unificada das reuniões da semana, tarefas com prazo e follow-ups agendados pelo
            Copiloto IA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View mode toggle */}
          <div className="flex items-center bg-white border border-[#E5E7EB] rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setViewMode('semana')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition',
                viewMode === 'semana'
                  ? 'bg-[#4F46E5] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]',
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Semana
            </button>
            <button
              onClick={() => setViewMode('dia')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition',
                viewMode === 'dia'
                  ? 'bg-[#4F46E5] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]',
              )}
            >
              <List className="w-3.5 h-3.5" />
              Lista por Dia
            </button>
          </div>

          <Button
            onClick={() => setNewEventModalOpen(true)}
            className="h-9 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Nova Reunião
          </Button>
        </div>
      </div>

      {/* Navigation and Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {/* Date Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="text-xs h-8 rounded-lg"
          >
            Hoje
          </Button>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevWeek}
              className="h-8 w-8 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4 text-[#4B5563]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextWeek}
              className="h-8 w-8 rounded-lg"
            >
              <ChevronRight className="w-4 h-4 text-[#4B5563]" />
            </Button>
          </div>
          <span className="text-xs font-semibold text-[#111827] ml-2">
            {weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} —{' '}
            {weekDays[6].toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'todos', label: 'Tudo' },
            { id: 'reunioes', label: 'Reuniões' },
            { id: 'tarefas', label: 'Tarefas' },
            { id: 'followups', label: 'Follow-ups' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id as typeof filterType)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-medium transition',
                filterType === f.id
                  ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold border border-indigo-200'
                  : 'bg-slate-100 text-[#6B7280] hover:bg-slate-200',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* VIEW: WEEK GRID (7 Columns) */}
      {viewMode === 'semana' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((dateObj, idx) => {
            const isToday = dateObj.toDateString() === new Date().toDateString()
            const dayItems = filteredItems.filter(
              (item) => item.date.toDateString() === dateObj.toDateString(),
            )

            return (
              <div
                key={idx}
                className={cn(
                  'bg-white rounded-2xl p-3 border min-h-[380px] flex flex-col justify-between shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all',
                  isToday
                    ? 'border-[#4F46E5] ring-1 ring-[#4F46E5]/20 bg-indigo-50/10'
                    : 'border-[#E5E7EB]',
                )}
              >
                <div>
                  <div className="pb-2 mb-2 border-b border-[#E5E7EB] text-center">
                    <span
                      className={cn(
                        'text-xs font-semibold block',
                        isToday ? 'text-[#4F46E5]' : 'text-[#111827]',
                      )}
                    >
                      {daysLabel[idx]}
                    </span>
                    <span
                      className={cn(
                        'text-[11px] inline-block mt-0.5 px-2 py-0.5 rounded-full font-bold',
                        isToday ? 'bg-[#4F46E5] text-white' : 'text-[#6B7280]',
                      )}
                    >
                      {dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {dayItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={cn(
                          'p-2.5 rounded-xl border cursor-pointer transition-all space-y-1 text-left shadow-xs',
                          item.sourceType === 'meeting'
                            ? 'bg-[#EEF2FF]/70 border-indigo-100 hover:bg-[#EEF2FF]'
                            : item.sourceType === 'task'
                              ? 'bg-amber-50/70 border-amber-100 hover:bg-amber-50'
                              : 'bg-emerald-50/70 border-emerald-100 hover:bg-emerald-50',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              'text-[9px] font-bold uppercase tracking-wider',
                              item.sourceType === 'meeting'
                                ? 'text-[#4F46E5]'
                                : item.sourceType === 'task'
                                  ? 'text-[#D97706]'
                                  : 'text-[#059669]',
                            )}
                          >
                            {item.sourceType === 'meeting'
                              ? 'Reunião'
                              : item.sourceType === 'task'
                                ? 'Tarefa'
                                : 'Follow-up'}
                          </span>
                          <span className="text-[10px] text-[#6B7280] font-mono">
                            {item.date.toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <span className="text-[11px] font-semibold text-[#111827] block truncate leading-snug">
                          {item.title}
                        </span>

                        {item.detail && (
                          <span className="text-[10px] text-[#6B7280] block truncate">
                            {item.detail}
                          </span>
                        )}
                      </div>
                    ))}

                    {dayItems.length === 0 && (
                      <div className="text-center py-14 text-[10px] text-[#9CA3AF]">
                        Sem compromissos
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-center text-[10px] text-[#9CA3AF]">
                  {dayItems.length} {dayItems.length === 1 ? 'item' : 'itens'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* VIEW: DAY LIST (Lista detalhada por dia) */}
      {viewMode === 'dia' && (
        <div className="space-y-4">
          {weekDays.map((dateObj, idx) => {
            const isToday = dateObj.toDateString() === new Date().toDateString()
            const dayItems = filteredItems.filter(
              (item) => item.date.toDateString() === dateObj.toDateString(),
            )

            return (
              <div
                key={idx}
                className={cn(
                  'bg-white rounded-2xl p-5 border shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-3',
                  isToday ? 'border-[#4F46E5] ring-1 ring-[#4F46E5]/20' : 'border-[#E5E7EB]',
                )}
              >
                <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#111827]">
                      {daysLabel[idx]}, {dateObj.toLocaleDateString('pt-BR')}
                    </span>
                    {isToday && (
                      <Badge className="bg-[#4F46E5] text-white text-[10px] px-2 py-0">Hoje</Badge>
                    )}
                  </div>
                  <span className="text-xs text-[#9CA3AF]">{dayItems.length} registros</span>
                </div>

                <div className="space-y-2">
                  {dayItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="p-3 rounded-xl border border-[#E5E7EB] hover:bg-[#F9FAFB] cursor-pointer transition flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs',
                            item.sourceType === 'meeting'
                              ? 'bg-[#EEF2FF] text-[#4F46E5]'
                              : item.sourceType === 'task'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700',
                          )}
                        >
                          {item.sourceType === 'meeting' ? (
                            <Video className="w-4 h-4" />
                          ) : item.sourceType === 'task' ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="font-semibold text-[#111827]">{item.title}</div>
                          <div className="text-[11px] text-[#6B7280]">
                            {item.detail || 'Sem observações adicionais'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-semibold text-[#111827]">
                          {item.date.toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                  ))}

                  {dayItems.length === 0 && (
                    <div className="text-center py-6 text-xs text-[#9CA3AF]">
                      Nenhum compromisso para este dia.
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Item Detail Modal */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#111827] flex items-center gap-2">
              {selectedItem?.sourceType === 'meeting' ? (
                <Video className="w-5 h-5 text-[#4F46E5]" />
              ) : selectedItem?.sourceType === 'task' ? (
                <CheckSquare className="w-5 h-5 text-amber-600" />
              ) : (
                <Clock className="w-5 h-5 text-emerald-600" />
              )}
              {selectedItem?.title}
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="py-2 space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Tipo:</span>
                  <span className="font-semibold capitalize text-[#111827]">
                    {selectedItem.sourceType === 'meeting'
                      ? 'Reunião Comercial'
                      : selectedItem.sourceType === 'task'
                        ? 'Tarefa Comercial'
                        : 'Follow-up Agendado'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Data e Horário:</span>
                  <span className="font-semibold text-[#111827]">
                    {selectedItem.date.toLocaleDateString('pt-BR')} às{' '}
                    {selectedItem.date.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Status:</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {selectedItem.status}
                  </Badge>
                </div>
                {selectedItem.detail && (
                  <div className="pt-2 border-t border-[#E5E7EB]">
                    <span className="text-[#6B7280] block mb-1">Detalhes:</span>
                    <p className="text-[#374151] leading-relaxed">{selectedItem.detail}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setSelectedItem(null)} className="text-xs">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Event Modal */}
      <Dialog open={newEventModalOpen} onOpenChange={setNewEventModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#111827]">
              Nova Reunião Comercial
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#374151]">Título da reunião:</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Apresentação de Proposta Consórcio Imobiliário"
                className="w-full text-xs p-2.5 border border-[#E5E7EB] rounded-xl bg-[#F9FAFB]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#374151]">Data e horário:</label>
              <input
                type="datetime-local"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full text-xs p-2.5 border border-[#E5E7EB] rounded-xl bg-[#F9FAFB]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#374151]">Formato:</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full text-xs p-2.5 border border-[#E5E7EB] rounded-xl bg-[#F9FAFB]"
              >
                <option value="Google Meet">Google Meet (Vídeo)</option>
                <option value="Presencial">Presencial (Escritório)</option>
                <option value="Ligação Telefônica">Ligação Telefônica</option>
              </select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setNewEventModalOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button
              onClick={handleCreateEvent}
              className="h-9 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold"
            >
              Criar na Agenda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
