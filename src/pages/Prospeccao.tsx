import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Compass,
  MapPin,
  Send,
  Download,
  Play,
  Pause,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Phone,
  Globe,
  Star,
  ExternalLink,
  Loader2,
  FileSpreadsheet,
  Users,
  ShieldCheck,
  CheckCheck,
  Layers,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/services/authContext'
import { prospectingService } from '@/services/prospectingService'
import { broadcastService } from '@/services/broadcastService'
import type { ProspectList, Prospect, GooglePlacesConfig, BroadcastCampaign } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Prospeccao() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  // State
  const [lists, setLists] = useState<ProspectList[]>([])
  const [selectedList, setSelectedList] = useState<ProspectList | null>(null)
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<BroadcastCampaign | null>(null)
  const [config, setConfig] = useState<GooglePlacesConfig | null>(null)

  const [loadingLists, setLoadingLists] = useState(true)
  const [loadingProspects, setLoadingProspects] = useState(false)
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)

  // Form State
  const [niche, setNiche] = useState('')
  const [location, setLocation] = useState('')
  const [targetVolume, setTargetVolume] = useState('20')
  const [dailyLimit, setDailyLimit] = useState('50')
  const [minInterval, setMinInterval] = useState('20')
  const [maxInterval, setMaxInterval] = useState('45')
  const [intervalError, setIntervalError] = useState<string | null>(null)
  const [messageTemplate, setMessageTemplate] = useState(
    'Olá, bom dia! Tudo bem? Esse é o número da {nome do estabelecimento}?',
  )
  const [starting, setStarting] = useState(false)

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'na_fila' | 'enviado' | 'respondido' | 'sem_whatsapp_valido' | 'duplicado'
  >('all')

  // Throttled processing batch state
  const [processingBatch, setProcessingBatch] = useState(false)

  // Load initial data
  const loadData = async () => {
    setLoadingLists(true)
    try {
      const [fetchedLists, cfg] = await Promise.all([
        prospectingService.getLists(),
        prospectingService.getConfig(),
      ])
      setLists(fetchedLists)
      setConfig(cfg)

      if (fetchedLists.length > 0) {
        if (!selectedList || !fetchedLists.find((l) => l.id === selectedList.id)) {
          setSelectedList(fetchedLists[0])
        }
      } else {
        setSelectedList(null)
      }
    } catch {
      toast({ title: 'Erro ao carregar prospecções', variant: 'destructive' })
    } finally {
      setLoadingLists(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Load prospects & linked campaign whenever selected list changes
  useEffect(() => {
    if (!selectedList) {
      setProspects([])
      setSelectedCampaign(null)
      return
    }

    const fetchDetails = async () => {
      setLoadingProspects(true)
      try {
        const [items, camp] = await Promise.all([
          prospectingService.getProspects(selectedList.id),
          selectedList.campaign
            ? broadcastService.getCampaign(selectedList.campaign).catch(() => null)
            : Promise.resolve(null),
        ])
        setProspects(items)
        setSelectedCampaign(camp)
      } catch {
        toast({ title: 'Erro ao carregar contatos da lista', variant: 'destructive' })
      } finally {
        setLoadingProspects(false)
      }
    }

    fetchDetails()
  }, [selectedList])

  // Handle Form Submission
  const handleStartProspecting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!niche.trim() || !location.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o nicho e o local para a prospecção.',
        variant: 'destructive',
      })
      return
    }

    const volume = parseInt(targetVolume, 10) || 10
    const limit = parseInt(dailyLimit, 10) || 50
    const minInt = parseInt(minInterval, 10)
    const maxInt = parseInt(maxInterval, 10)

    if (isNaN(minInt) || minInt < 5) {
      setIntervalError('O intervalo mínimo entre envios deve ser de pelo menos 5 segundos.')
      toast({
        title: 'Intervalo inválido',
        description: 'O intervalo mínimo deve ser ≥ 5 segundos.',
        variant: 'destructive',
      })
      return
    }

    if (isNaN(maxInt) || maxInt < minInt) {
      setIntervalError('O intervalo máximo deve ser maior ou igual ao intervalo mínimo.')
      toast({
        title: 'Intervalo inválido',
        description: 'O intervalo máximo deve ser maior ou igual ao mínimo.',
        variant: 'destructive',
      })
      return
    }

    setIntervalError(null)
    setStarting(true)
    try {
      const res = await prospectingService.startProspecting({
        niche: niche.trim(),
        location: location.trim(),
        target_volume: volume,
        daily_limit: limit,
        min_interval_seconds: minInt,
        max_interval_seconds: maxInt,
        message_template: messageTemplate.trim(),
      })

      if (res.ok && res.prospect_list) {
        toast({
          title: 'Prospecção iniciada com sucesso!',
          description: `${res.total_collected} estabelecimentos coletados via Google Maps (${res.valid_phone_count} contatos válidos e enfileirados).`,
        })

        setIsNewDialogOpen(false)
        setNiche('')
        setLocation('')

        await loadData()
        setSelectedList(res.prospect_list)
      } else {
        toast({
          title: 'Falha ao iniciar prospecção',
          description: res.error || 'Ocorreu um erro ao consultar o Google Maps.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Erro inesperado',
        description: 'Não foi possível completar a operação de prospecção.',
        variant: 'destructive',
      })
    } finally {
      setStarting(false)
    }
  }

  // Handle Batch Triggering
  const handleTriggerBatch = async () => {
    if (!selectedCampaign) return
    setProcessingBatch(true)
    try {
      const res = await broadcastService.processNextBatch(selectedCampaign.id)
      if (res.completed) {
        toast({
          title: 'Envios concluídos!',
          description: 'Todos os disparos desta lista de prospecção foram finalizados.',
        })
      } else if (res.waiting_approval) {
        toast({
          title: 'Aprovação humana necessária',
          description: 'Aprove as mensagens no módulo de Disparos para continuar.',
        })
      } else {
        toast({
          title: `Lote disparado (${res.processed} mensagens)`,
          description: res.last_interval_seconds
            ? `Intervalo sorteado neste envio: ${res.last_interval_seconds}s (faixa ${selectedList?.min_interval_seconds || 20}–${selectedList?.max_interval_seconds || 45}s).`
            : `Intervalo sorteado randomicamente por envio (${selectedList?.min_interval_seconds || 20}–${selectedList?.max_interval_seconds || 45}s).`,
        })
      }

      // Refresh list & prospects
      if (selectedList) {
        const [updatedList, updatedProspects, updatedCamp] = await Promise.all([
          prospectingService.getList(selectedList.id),
          prospectingService.getProspects(selectedList.id),
          broadcastService.getCampaign(selectedCampaign.id),
        ])
        setSelectedList(updatedList)
        setProspects(updatedProspects)
        setSelectedCampaign(updatedCamp)
        setLists((prev) => prev.map((l) => (l.id === updatedList.id ? updatedList : l)))
      }
    } catch {
      toast({ title: 'Erro ao disparar lote', variant: 'destructive' })
    } finally {
      setProcessingBatch(false)
    }
  }

  // Toggle Pause/Resume Campaign
  const handleToggleCampaignStatus = async (newStatus: 'paused' | 'running') => {
    if (!selectedCampaign) return
    try {
      await broadcastService.updateStatus(selectedCampaign.id, newStatus)
      toast({
        title: newStatus === 'paused' ? 'Campanha pausada' : 'Campanha retomada',
        description: `O envio cadenciado foi ${newStatus === 'paused' ? 'pausado' : 'retomado'}.`,
      })
      const updatedCamp = await broadcastService.getCampaign(selectedCampaign.id)
      setSelectedCampaign(updatedCamp)
    } catch {
      toast({ title: 'Erro ao alterar status da campanha', variant: 'destructive' })
    }
  }

  // Filtered Prospects
  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      const matchSearch =
        p.establishment_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.formatted_phone && p.formatted_phone.includes(searchTerm)) ||
        (p.address && p.address.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchStatus = statusFilter === 'all' ? true : p.status === statusFilter

      return matchSearch && matchStatus
    })
  }, [prospects, searchTerm, statusFilter])

  // Aggregate Metrics across all lists
  const globalMetrics = useMemo(() => {
    const totalLists = lists.length
    const totalCollected = lists.reduce((acc, l) => acc + (l.total_collected || 0), 0)
    const totalDispatched = lists.reduce((acc, l) => acc + (l.dispatched_count || 0), 0)
    const totalReplied = lists.reduce((acc, l) => acc + (l.replied_count || 0), 0)
    const responseRate =
      totalDispatched > 0 ? Math.round((totalReplied / totalDispatched) * 100) : 0

    return { totalLists, totalCollected, totalDispatched, totalReplied, responseRate }
  }, [lists])

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#4F46E5] text-white flex items-center justify-center shadow-sm shadow-indigo-100">
              <Compass className="w-4 h-4" />
            </div>
            Prospecção Ativa via Google Maps
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Geração de listas comerciais por nicho e região com extração do Google Places,
            deduplicação automática e disparo cadenciado anti-ban.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {config?.is_demo && (
            <Badge
              variant="outline"
              onClick={() => navigate('/configuracoes?tab=conexoes')}
              className="cursor-pointer bg-amber-50 text-amber-700 border-amber-200 text-xs py-1 px-2.5 hover:bg-amber-100 transition"
              title="Clique para configurar chave oficial do Google Places em Configurações"
            >
              <Sparkles className="w-3 h-3 mr-1 inline text-amber-500" />
              Modo Demonstração (Google Maps)
            </Badge>
          )}

          <Button variant="outline" size="sm" onClick={loadData} className="h-9 rounded-xl text-xs">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Atualizar
          </Button>

          <Button
            onClick={() => setIsNewDialogOpen(true)}
            className="h-9 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold gap-1.5 shadow-sm"
          >
            <MapPin className="w-4 h-4" /> Nova Prospecção
          </Button>
        </div>
      </div>

      {/* Global Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-[11px] font-medium text-[#6B7280] block">Listas Criadas</span>
          <span className="text-xl font-bold text-[#111827] mt-1 block">
            {globalMetrics.totalLists}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-[11px] font-medium text-[#6B7280] block">Empresas Coletadas</span>
          <span className="text-xl font-bold text-indigo-600 mt-1 block">
            {globalMetrics.totalCollected}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-[11px] font-medium text-[#6B7280] block">Disparos Realizados</span>
          <span className="text-xl font-bold text-emerald-600 mt-1 block">
            {globalMetrics.totalDispatched}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-[11px] font-medium text-[#6B7280] block">
            Respostas no WhatsApp
          </span>
          <span className="text-xl font-bold text-blue-600 mt-1 block">
            {globalMetrics.totalReplied}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-[11px] font-medium text-[#6B7280] block">Taxa de Resposta</span>
          <span className="text-xl font-bold text-[#111827] mt-1 block">
            {globalMetrics.responseRate}%
          </span>
        </div>
      </div>

      {/* Main Grid: Left Lists + Right Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Prospecting Lists (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              Listas de Prospecção
            </h3>
            <span className="text-[11px] text-[#9CA3AF]">{lists.length} registradas</span>
          </div>

          {loadingLists ? (
            <div className="py-16 text-center text-xs text-[#6B7280] space-y-2">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#4F46E5]" />
              <span>Carregando prospecções...</span>
            </div>
          ) : lists.length === 0 ? (
            <div className="py-14 text-center text-xs text-[#6B7280] space-y-3">
              <Compass className="w-8 h-8 text-[#9CA3AF] mx-auto opacity-50" />
              <p>Nenhuma prospecção realizada ainda.</p>
              <Button
                size="sm"
                onClick={() => setIsNewDialogOpen(true)}
                className="text-xs bg-[#4F46E5] text-white"
              >
                <MapPin className="w-3.5 h-3.5 mr-1" /> Criar Primeira Prospecção
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto no-scrollbar">
              {lists.map((l) => {
                const isSelected = selectedList?.id === l.id
                return (
                  <div
                    key={l.id}
                    onClick={() => setSelectedList(l)}
                    className={cn(
                      'p-3.5 rounded-2xl border cursor-pointer transition-all space-y-2',
                      isSelected
                        ? 'bg-[#EEF2FF]/60 border-indigo-300 shadow-sm'
                        : 'border-[#E5E7EB] hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-[#111827] flex items-center gap-1.5 capitalize">
                          {l.niche}
                        </h4>
                        <span className="text-[11px] text-[#6B7280] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-[#9CA3AF]" />
                          {l.location}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] capitalize px-2 py-0.2',
                          l.status === 'completed' &&
                            'bg-emerald-50 text-emerald-700 border-emerald-200',
                          l.status === 'dispatching' &&
                            'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse',
                          l.status === 'paused' && 'bg-amber-50 text-amber-700 border-amber-200',
                          l.status === 'ready' && 'bg-blue-50 text-blue-700 border-blue-200',
                          l.status === 'collecting' && 'bg-slate-100 text-[#4B5563]',
                        )}
                      >
                        {l.status === 'ready'
                          ? 'Pronta'
                          : l.status === 'dispatching'
                            ? 'Disparando'
                            : l.status === 'completed'
                              ? 'Concluída'
                              : l.status === 'paused'
                                ? 'Pausada'
                                : 'Coletando'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100 text-[10px] text-[#6B7280]">
                      <div>
                        Coletados:{' '}
                        <strong className="text-[#111827]">{l.total_collected || 0}</strong>
                      </div>
                      <div>
                        Válidos:{' '}
                        <strong className="text-emerald-600">{l.valid_phone_count || 0}</strong>
                      </div>
                      <div>
                        Enviados:{' '}
                        <strong className="text-indigo-600">{l.dispatched_count || 0}</strong>
                      </div>
                    </div>

                    {l.is_demo && (
                      <span className="text-[9px] text-amber-600 font-medium inline-block">
                        • Modo Demonstração
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected List Details, Campaign Control & Contacts Table (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedList ? (
            <div className="bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-6">
              {/* List Header & Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-[#111827] capitalize">
                      {selectedList.niche} — {selectedList.location}
                    </h2>
                    {selectedList.is_demo && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                      >
                        Demonstração
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-xs text-[#6B7280]">
                      Meta: <strong>{selectedList.target_volume} estabelecimentos</strong> | Limite
                      diário: <strong>{selectedList.daily_limit || 50} envios/dia</strong>
                    </p>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200"
                    >
                      Intervalo:{' '}
                      {selectedList.min_interval_seconds ||
                        selectedCampaign?.min_interval_seconds ||
                        20}
                      –
                      {selectedList.max_interval_seconds ||
                        selectedCampaign?.max_interval_seconds ||
                        45}
                      s
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Export CSV */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => prospectingService.exportCsv(selectedList, prospects)}
                    className="h-8 text-xs gap-1.5"
                    title="Exportar contatos desta prospecção em formato CSV"
                  >
                    <Download className="w-3.5 h-3.5" /> Exportar CSV
                  </Button>

                  {/* Batch Trigger Button */}
                  {selectedCampaign && selectedCampaign.status !== 'completed' && (
                    <>
                      {selectedCampaign.status === 'running' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleCampaignStatus('paused')}
                          className="h-8 text-xs text-amber-700 border-amber-300 gap-1"
                        >
                          <Pause className="w-3.5 h-3.5" /> Pausar Disparos
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleTriggerBatch}
                          disabled={processingBatch}
                          className="h-8 text-xs bg-[#10B981] hover:bg-[#059669] text-white gap-1.5 shadow-sm"
                        >
                          {processingBatch ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          Disparar Próximo Lote
                        </Button>
                      )}
                    </>
                  )}

                  {/* Direct link to Disparos module */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate('/disparos')}
                    className="h-8 text-xs text-indigo-600 gap-1"
                  >
                    Ver em Disparos <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Progress Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#F9FAFB] p-3 rounded-2xl border border-[#E5E7EB]">
                  <span className="text-[10px] text-[#6B7280] font-medium block">
                    Coletados (Maps)
                  </span>
                  <span className="text-base font-bold text-[#111827] mt-0.5 block">
                    {selectedList.total_collected || 0}
                  </span>
                </div>
                <div className="bg-[#F9FAFB] p-3 rounded-2xl border border-[#E5E7EB]">
                  <span className="text-[10px] text-[#6B7280] font-medium block">
                    Válidos na Fila
                  </span>
                  <span className="text-base font-bold text-emerald-600 mt-0.5 block">
                    {selectedList.valid_phone_count || 0}
                  </span>
                </div>
                <div className="bg-[#F9FAFB] p-3 rounded-2xl border border-[#E5E7EB]">
                  <span className="text-[10px] text-[#6B7280] font-medium block">
                    Mensagens Enviadas
                  </span>
                  <span className="text-base font-bold text-indigo-600 mt-0.5 block">
                    {selectedList.dispatched_count || 0}
                  </span>
                </div>
                <div className="bg-[#F9FAFB] p-3 rounded-2xl border border-[#E5E7EB]">
                  <span className="text-[10px] text-[#6B7280] font-medium block">Respostas</span>
                  <span className="text-base font-bold text-blue-600 mt-0.5 block">
                    {selectedList.replied_count || 0}
                  </span>
                </div>
              </div>

              {/* Message Template Display Card */}
              <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] flex items-center gap-1.5">
                  <Send className="w-3 h-3 text-indigo-600" />
                  Modelo de Abordagem Cadenciada
                </span>
                <p className="text-xs text-[#111827] font-mono bg-white p-2.5 rounded-xl border border-[#E5E7EB] whitespace-pre-wrap">
                  {selectedList.message_template}
                </p>
                <div className="flex items-center justify-between text-[10px] text-[#6B7280] pt-1 flex-wrap gap-2">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Intervalo sorteado por envio:{' '}
                    <strong>
                      {selectedList.min_interval_seconds ||
                        selectedCampaign?.min_interval_seconds ||
                        20}
                      s a{' '}
                      {selectedList.max_interval_seconds ||
                        selectedCampaign?.max_interval_seconds ||
                        45}
                      s
                    </strong>
                  </span>
                  <span>
                    Modo Autonomia:{' '}
                    {profile?.autonomy_mode === 'copilot'
                      ? 'Aprovação Manual'
                      : 'Disparo Automático'}
                  </span>
                </div>
              </div>

              {/* Contacts Table Filter & Search */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B5563] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    Contatos da Prospecção ({filteredProspects.length} de {prospects.length})
                  </h3>

                  <div className="flex items-center gap-2">
                    {/* Status Filter */}
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                      className="text-xs h-8 px-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-[#374151]"
                    >
                      <option value="all">Todos os status</option>
                      <option value="na_fila">Na fila</option>
                      <option value="enviado">Enviado</option>
                      <option value="respondido">Respondido</option>
                      <option value="sem_whatsapp_valido">Sem WhatsApp válido</option>
                      <option value="duplicado">Duplicado</option>
                    </select>

                    <div className="relative w-full sm:w-52">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#9CA3AF]" />
                      <Input
                        placeholder="Buscar empresa ou fone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="text-xs h-8 pl-8 rounded-xl bg-[#F9FAFB]"
                      />
                    </div>
                  </div>
                </div>

                {loadingProspects ? (
                  <div className="py-12 text-center text-xs text-[#6B7280] space-y-2">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-[#4F46E5]" />
                    <span>Carregando contatos...</span>
                  </div>
                ) : filteredProspects.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#6B7280] bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB]">
                    Nenhum contato encontrado com os filtros selecionados.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-2xl overflow-hidden">
                    {filteredProspects.map((p) => {
                      return (
                        <div
                          key={p.id}
                          className="p-3.5 bg-white hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[#111827]">
                                {p.establishment_name}
                              </span>
                              {p.google_rating ? (
                                <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded-md">
                                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                  {p.google_rating}
                                </span>
                              ) : null}
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] capitalize px-2 py-0.2',
                                  p.status === 'respondido' &&
                                    'bg-blue-50 text-blue-700 border-blue-200',
                                  p.status === 'enviado' &&
                                    'bg-emerald-50 text-emerald-700 border-emerald-200',
                                  p.status === 'na_fila' &&
                                    'bg-indigo-50 text-indigo-700 border-indigo-200',
                                  p.status === 'sem_whatsapp_valido' &&
                                    'bg-rose-50 text-rose-700 border-rose-200',
                                  p.status === 'duplicado' && 'bg-slate-100 text-[#6B7280]',
                                  p.status === 'falha' &&
                                    'bg-rose-50 text-rose-700 border-rose-200',
                                )}
                              >
                                {p.status === 'na_fila'
                                  ? 'Na Fila'
                                  : p.status === 'enviado'
                                    ? 'Enviado'
                                    : p.status === 'respondido'
                                      ? 'Respondido'
                                      : p.status === 'sem_whatsapp_valido'
                                        ? 'Sem WhatsApp'
                                        : p.status === 'duplicado'
                                          ? 'Duplicado'
                                          : 'Falha'}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-[#6B7280] flex-wrap">
                              <span className="flex items-center gap-1 font-mono">
                                <Phone className="w-3 h-3 text-[#9CA3AF]" />
                                {p.formatted_phone || p.raw_phone || 'Telefone não localizado'}
                              </span>
                              {p.address && (
                                <span className="flex items-center gap-1 truncate max-w-xs">
                                  <MapPin className="w-3 h-3 text-[#9CA3AF]" />
                                  {p.address}
                                </span>
                              )}
                              {p.website && (
                                <a
                                  href={p.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 text-indigo-600 hover:underline"
                                >
                                  <Globe className="w-3 h-3" />
                                  Site
                                </a>
                              )}
                            </div>

                            <p className="text-[11px] text-[#4B5563] line-clamp-1 italic bg-[#F9FAFB] p-1.5 rounded-lg border border-slate-100">
                              "{p.rendered_message}"
                            </p>
                          </div>

                          {/* Action Button: Go to Conversation if lead was created */}
                          {p.contact && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate('/conversas')}
                              className="h-7 text-[11px] text-[#4B5563] self-end md:self-center"
                            >
                              Ver Conversa <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 border border-[#E5E7EB] text-center space-y-3">
              <Compass className="w-10 h-10 text-[#9CA3AF] mx-auto opacity-50" />
              <h3 className="text-sm font-bold text-[#111827]">Nenhuma prospecção selecionada</h3>
              <p className="text-xs text-[#6B7280]">
                Selecione uma prospecção na lista ao lado ou inicie uma nova com nicho e local.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* NEW PROSPECTING DIALOG */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-white rounded-3xl p-6 border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#111827] flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#4F46E5]" />
              Iniciar Nova Prospecção Comercial
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              Informe o nicho e a localização desejada. A ferramenta buscará os contatos no Google
              Maps, formatará a lista e preparará o disparo cadenciado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleStartProspecting} className="space-y-4 pt-2">
            {/* Nicho */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#374151]">
                Nicho de Prospecção <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Ex.: Clínicas odontológicas, imobiliárias, oficinas mecânicas..."
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                required
                className="text-xs h-10 rounded-xl bg-[#F9FAFB]"
              />
              <span className="text-[10px] text-[#6B7280]">
                O nicho comercial que o consultor irá prospectar.
              </span>
            </div>

            {/* Local */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#374151]">
                Local (Cidade, Bairro ou Região) <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Ex.: Curitiba - PR, Jardins São Paulo, Barra da Tijuca..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="text-xs h-10 rounded-xl bg-[#F9FAFB]"
              />
              <span className="text-[10px] text-[#6B7280]">
                Área geográfica para extração dos estabelecimentos no Google Maps.
              </span>
            </div>

            {/* Volumes: Total + Limite Diário */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#374151]">
                  Volume Total a Disparar
                </label>
                <Input
                  type="number"
                  min="5"
                  max="100"
                  value={targetVolume}
                  onChange={(e) => setTargetVolume(e.target.value)}
                  className="text-xs h-10 rounded-xl bg-[#F9FAFB]"
                />
                <span className="text-[10px] text-[#6B7280]">Meta de contatos (5 a 100)</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#374151]">
                  Limite Diário de Envios
                </label>
                <Input
                  type="number"
                  min="10"
                  max="100"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  className="text-xs h-10 rounded-xl bg-[#F9FAFB]"
                />
                <span className="text-[10px] text-[#6B7280]">Prevenção de bloqueio</span>
              </div>
            </div>

            {/* Configuração de Intervalo de Disparo (Min e Max lado a lado) */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-[#4F46E5]" />
                Intervalo de Disparo Anti-Ban (Randomizado)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#374151]">
                    Intervalo mínimo entre envios (s) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="5"
                      value={minInterval}
                      onChange={(e) => {
                        const val = e.target.value
                        setMinInterval(val)
                        const nMin = parseInt(val, 10)
                        const nMax = parseInt(maxInterval, 10)
                        if (isNaN(nMin) || nMin < 5) {
                          setIntervalError('O intervalo mínimo deve ser de no mínimo 5 segundos.')
                        } else if (!isNaN(nMax) && nMax < nMin) {
                          setIntervalError('O intervalo máximo deve ser maior ou igual ao mínimo.')
                        } else {
                          setIntervalError(null)
                        }
                      }}
                      required
                      className="text-xs h-9 pr-18 bg-white rounded-xl border-[#E5E7EB]"
                    />
                    <span className="absolute right-3 top-2 text-[11px] text-[#9CA3AF] pointer-events-none">
                      segundos
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#374151]">
                    Intervalo máximo entre envios (s) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={minInterval || '5'}
                      value={maxInterval}
                      onChange={(e) => {
                        const val = e.target.value
                        setMaxInterval(val)
                        const nMax = parseInt(val, 10)
                        const nMin = parseInt(minInterval, 10)
                        if (!isNaN(nMax) && !isNaN(nMin) && nMax < nMin) {
                          setIntervalError('O intervalo máximo deve ser maior ou igual ao mínimo.')
                        } else if (isNaN(nMin) || nMin < 5) {
                          setIntervalError('O intervalo mínimo deve ser de no mínimo 5 segundos.')
                        } else {
                          setIntervalError(null)
                        }
                      }}
                      required
                      className={cn(
                        'text-xs h-9 pr-18 bg-white rounded-xl border-[#E5E7EB]',
                        intervalError && 'border-rose-400 focus-visible:ring-rose-400',
                      )}
                    />
                    <span className="absolute right-3 top-2 text-[11px] text-[#9CA3AF] pointer-events-none">
                      segundos
                    </span>
                  </div>
                </div>
              </div>

              {/* Erro inline */}
              {intervalError && (
                <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  {intervalError}
                </p>
              )}

              {/* Helper text curto */}
              <p className="text-[11px] text-[#6B7280] leading-relaxed">
                O sistema sorteia um intervalo entre o mínimo e o máximo a cada envio para simular
                comportamento humano.
              </p>
            </div>

            {/* Template de Mensagem Inicial */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#374151]">
                  Mensagem Inicial Personalizada
                </label>
                <span className="text-[10px] text-indigo-600 font-mono">
                  Variável: &#123;nome do estabelecimento&#125;
                </span>
              </div>
              <Textarea
                rows={3}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                className="text-xs rounded-xl bg-[#F9FAFB] font-mono leading-relaxed"
              />
              <span className="text-[10px] text-[#6B7280]">
                Frase inicial que será adaptada para cada estabelecimento encontrado.
              </span>
            </div>

            {/* Info notice about Google Maps mode */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-[#E5E7EB] text-xs text-[#4B5563] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[#111827]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Motor Anti-Bloqueio Integrado
              </div>
              <p className="text-[11px] leading-snug">
                Os contatos coletados serão automaticamente cadastrados como "Novo Lead", com
                oportunidade no funil comercial e campanha vinculada no módulo de Disparos.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewDialogOpen(false)}
                disabled={starting}
                className="text-xs h-9 rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={starting}
                className="text-xs h-9 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold gap-1.5 shadow-sm"
              >
                {starting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Consultando Maps & Gerando Lista...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Iniciar prospecção
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
