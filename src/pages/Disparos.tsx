import { useState, useEffect } from 'react'
import {
  Send,
  Plus,
  Play,
  Pause,
  XCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Search,
  Filter,
  RefreshCw,
  Sliders,
  CheckCheck,
  Eye,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { broadcastService } from '@/services/broadcastService'
import { useAuth } from '@/services/authContext'
import pb from '@/lib/pocketbase/client'
import type { BroadcastCampaign, BroadcastRecipient, Contact } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Disparos() {
  const { profile } = useAuth()
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<BroadcastCampaign | null>(null)
  const [recipients, setRecipients] = useState<BroadcastRecipient[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)

  // Creation modal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [template, setTemplate] = useState(
    'Olá {{primeiro_nome}}, tudo bem? Passando para compartilhar uma nova oportunidade que se encaixa no seu perfil.',
  )
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [minInterval, setMinInterval] = useState(15)
  const [maxInterval, setMaxInterval] = useState(30)
  const [scheduledAt, setScheduledAt] = useState('')
  const [manualApproval, setManualApproval] = useState(profile?.autonomy_mode === 'copilot')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [creating, setCreating] = useState(false)

  // Processing state
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Filter & search
  const [searchTerm, setSearchTerm] = useState('')

  const loadCampaigns = async () => {
    try {
      const list = await broadcastService.getCampaigns()
      setCampaigns(list)
      if (list.length > 0 && !selectedCampaign) {
        setSelectedCampaign(list[0])
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  const loadRecipients = async (campaignId: string) => {
    setLoadingRecipients(true)
    try {
      const recs = await broadcastService.getRecipients(campaignId)
      setRecipients(recs)
    } finally {
      setLoadingRecipients(false)
    }
  }

  useEffect(() => {
    loadCampaigns()
    // Load contacts for preview
    pb.collection('contacts')
      .getFullList<Contact>({ sort: 'name' })
      .then((c) => setContacts(c))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedCampaign) {
      loadRecipients(selectedCampaign.id)
    }
  }, [selectedCampaign])

  const handleCreate = async () => {
    if (!title.trim() || !template.trim()) {
      toast({ title: 'Preencha título e mensagem', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res = await broadcastService.createCampaign({
        title,
        message_template: template,
        audience_filter: { category: categoryFilter },
        scheduled_at: scheduledAt || null,
        min_interval_seconds: minInterval,
        max_interval_seconds: maxInterval,
        requires_manual_approval: manualApproval,
      })
      if (res.ok && res.campaign) {
        toast({
          title: 'Campanha criada com sucesso!',
          description: `${res.total_recipients} destinatários preparados. ${res.requires_manual_approval ? 'Aguardando aprovação humana.' : 'Pronta para envio.'}`,
        })
        setIsCreateOpen(false)
        setTitle('')
        await loadCampaigns()
        setSelectedCampaign(res.campaign)
      } else {
        toast({ title: res.error || 'Erro ao criar campanha', variant: 'destructive' })
      }
    } finally {
      setCreating(false)
    }
  }

  const handleProcessBatch = async (campId: string) => {
    setProcessingId(campId)
    try {
      const res = await broadcastService.processNextBatch(campId)
      if (res.completed) {
        toast({ title: 'Campanha concluída!', description: 'Todos os disparos foram realizados.' })
      } else if (res.waiting_approval) {
        toast({
          title: 'Aguardando aprovação',
          description: 'Aprove as mensagens na lista abaixo para liberar o envio.',
        })
      } else {
        toast({
          title: `Lote disparado (${res.processed} mensagens)`,
          description: 'Intervalos com jitter aplicados com segurança anti-ban.',
        })
      }
      await loadCampaigns()
      if (selectedCampaign?.id === campId) {
        await loadRecipients(campId)
      }
    } finally {
      setProcessingId(null)
    }
  }

  const handleApproveAll = async (campId: string) => {
    const res = await broadcastService.approveRecipients({
      campaign_id: campId,
      approve_all: true,
    })
    if (res.ok) {
      toast({
        title: 'Mensagens aprovadas!',
        description: `${res.approved_count} destinatários liberados para disparo.`,
      })
      if (selectedCampaign) await loadRecipients(selectedCampaign.id)
    }
  }

  const handleApproveSingle = async (recId: string) => {
    const res = await broadcastService.approveRecipients({
      recipient_id: recId,
    })
    if (res.ok) {
      toast({ title: 'Mensagem aprovada com sucesso.' })
      if (selectedCampaign) await loadRecipients(selectedCampaign.id)
    }
  }

  const handleStatusChange = async (
    campId: string,
    newStatus: 'paused' | 'running' | 'cancelled',
  ) => {
    await broadcastService.updateStatus(campId, newStatus)
    toast({ title: `Campanha alterada para ${newStatus}` })
    await loadCampaigns()
  }

  const filteredRecipients = recipients.filter(
    (r) =>
      r.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.recipient_phone.includes(searchTerm) ||
      r.rendered_message.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const audiencePreviewCount =
    categoryFilter === 'all'
      ? contacts.length
      : contacts.filter((c) => c.category === categoryFilter).length

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] flex items-center gap-2">
            <Send className="w-6 h-6 text-[#4F46E5]" />
            Disparos no WhatsApp
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Campanhas segmentadas com variáveis personalizadas, fluxo de aprovação e throttling
            anti-ban.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadCampaigns}
            className="h-9 rounded-xl text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Atualizar
          </Button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="h-9 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nova Campanha
          </Button>
        </div>
      </div>

      {/* Campaign Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-[11px] font-medium text-[#6B7280] block">Total Campanhas</span>
          <span className="text-xl font-bold text-[#111827] mt-1 block">{campaigns.length}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-[11px] font-medium text-[#6B7280] block">Mensagens Enviadas</span>
          <span className="text-xl font-bold text-indigo-600 mt-1 block">
            {campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0)}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-[11px] font-medium text-[#6B7280] block">Entregues</span>
          <span className="text-xl font-bold text-emerald-600 mt-1 block">
            {campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0)}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-[11px] font-medium text-[#6B7280] block">Respostas Obtidas</span>
          <span className="text-xl font-bold text-blue-600 mt-1 block">
            {campaigns.reduce((acc, c) => acc + (c.replied_count || 0), 0)}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-[11px] font-medium text-[#6B7280] block">Taxa de Resposta</span>
          <span className="text-xl font-bold text-[#111827] mt-1 block">
            {(() => {
              const sent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0)
              const replied = campaigns.reduce((acc, c) => acc + (c.replied_count || 0), 0)
              return sent > 0 ? `${Math.round((replied / sent) * 100)}%` : '0%'
            })()}
          </span>
        </div>
      </div>

      {/* Main split view: Campaigns list + Selected campaign detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Campaigns list (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
              Campanhas Recentes
            </h3>
            <span className="text-[11px] text-[#9CA3AF]">{campaigns.length} registradas</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-[#6B7280] space-y-2">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#4F46E5]" />
              <span>Carregando campanhas...</span>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#6B7280] space-y-3">
              <Send className="w-8 h-8 text-[#9CA3AF] mx-auto opacity-50" />
              <p>Nenhuma campanha criada ainda.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCreateOpen(true)}
                className="text-xs"
              >
                Criar primeira campanha
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto no-scrollbar">
              {campaigns.map((c) => {
                const isSelected = selectedCampaign?.id === c.id
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCampaign(c)}
                    className={cn(
                      'p-3.5 rounded-2xl border cursor-pointer transition-all space-y-2',
                      isSelected
                        ? 'bg-[#EEF2FF]/50 border-indigo-300 shadow-sm'
                        : 'border-[#E5E7EB] hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-[#111827] line-clamp-1">{c.title}</h4>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] capitalize px-2 py-0.2',
                          c.status === 'completed' &&
                            'bg-emerald-50 text-emerald-700 border-emerald-200',
                          c.status === 'running' &&
                            'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse',
                          c.status === 'paused' && 'bg-amber-50 text-amber-700 border-amber-200',
                          c.status === 'draft' && 'bg-slate-100 text-[#4B5563]',
                        )}
                      >
                        {c.status === 'running'
                          ? 'Em envio'
                          : c.status === 'completed'
                            ? 'Concluída'
                            : c.status === 'paused'
                              ? 'Pausada'
                              : 'Rascunho'}
                      </Badge>
                    </div>

                    <p className="text-[11px] text-[#6B7280] line-clamp-2 italic">
                      "{c.message_template}"
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-[#6B7280] pt-1 border-t border-slate-100">
                      <span>
                        Enviados: <strong>{c.sent_count || 0}</strong>/{c.total_recipients || 0}
                      </span>
                      <span>
                        {c.requires_manual_approval && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] bg-amber-50 text-amber-700"
                          >
                            Aprovação Humana
                          </Badge>
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Selected campaign detail, live progress & recipients (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedCampaign ? (
            <div className="bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-6">
              {/* Campaign Topbar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#111827]">{selectedCampaign.title}</h2>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedCampaign.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Throttling anti-ban configurado: {selectedCampaign.min_interval_seconds}s a{' '}
                    {selectedCampaign.max_interval_seconds}s entre mensagens.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedCampaign.status !== 'completed' && (
                    <>
                      {selectedCampaign.status === 'running' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(selectedCampaign.id, 'paused')}
                          className="h-8 text-xs text-amber-700 border-amber-300"
                        >
                          <Pause className="w-3.5 h-3.5 mr-1" /> Pausar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleProcessBatch(selectedCampaign.id)}
                          disabled={processingId === selectedCampaign.id}
                          className="h-8 text-xs bg-[#10B981] hover:bg-[#059669] text-white"
                        >
                          {processingId === selectedCampaign.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : (
                            <Play className="w-3.5 h-3.5 mr-1" />
                          )}
                          Disparar Próximo Lote
                        </Button>
                      )}
                    </>
                  )}

                  {selectedCampaign.requires_manual_approval && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApproveAll(selectedCampaign.id)}
                      className="h-8 text-xs text-indigo-700 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
                    >
                      <CheckCheck className="w-3.5 h-3.5 mr-1" /> Aprovar Todas
                    </Button>
                  )}
                </div>
              </div>

              {/* Message Template Card */}
              <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#4B5563]">
                  Modelo de Mensagem Configurado
                </span>
                <p className="text-xs text-[#111827] whitespace-pre-wrap font-mono bg-white p-3 rounded-xl border border-[#E5E7EB]">
                  {selectedCampaign.message_template}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#111827]">
                  <span>Progresso do Disparo</span>
                  <span>
                    {selectedCampaign.total_recipients > 0
                      ? Math.round(
                          ((selectedCampaign.sent_count || 0) / selectedCampaign.total_recipients) *
                            100,
                        )
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-[#4F46E5] transition-all duration-500 rounded-full"
                    style={{
                      width: `${
                        selectedCampaign.total_recipients > 0
                          ? ((selectedCampaign.sent_count || 0) /
                              selectedCampaign.total_recipients) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Recipients list */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B5563] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Destinatários da Audiência ({recipients.length})
                  </h3>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#9CA3AF]" />
                    <Input
                      placeholder="Buscar destinatário..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="text-xs h-8 pl-8 rounded-xl bg-[#F9FAFB]"
                    />
                  </div>
                </div>

                {loadingRecipients ? (
                  <div className="py-8 text-center text-xs text-[#6B7280]">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-[#4F46E5]" />
                    <span>Carregando destinatários...</span>
                  </div>
                ) : filteredRecipients.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#6B7280] bg-[#F9FAFB] rounded-2xl">
                    Nenhum destinatário encontrado com esse filtro.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-2xl overflow-hidden">
                    {filteredRecipients.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-3.5 bg-white hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#111827]">
                              {rec.recipient_name || 'Contato'}
                            </span>
                            <span className="text-[#6B7280] font-mono text-[11px]">
                              {rec.recipient_phone}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#4B5563] line-clamp-1 italic">
                            "{rec.rendered_message}"
                          </p>
                          {rec.error_details && (
                            <span className="text-[10px] text-rose-600 block">
                              Erro: {rec.error_details}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] capitalize',
                              rec.status === 'sent' &&
                                'bg-emerald-50 text-emerald-700 border-emerald-200',
                              rec.status === 'read' && 'bg-blue-50 text-blue-700 border-blue-200',
                              rec.status === 'waiting_approval' &&
                                'bg-amber-50 text-amber-700 border-amber-200',
                              rec.status === 'approved' &&
                                'bg-indigo-50 text-indigo-700 border-indigo-200',
                              rec.status === 'error' && 'bg-rose-50 text-rose-700 border-rose-200',
                            )}
                          >
                            {rec.status === 'waiting_approval'
                              ? 'Aguardando Aprovação'
                              : rec.status === 'approved'
                                ? 'Aprovado'
                                : rec.status === 'sent'
                                  ? 'Enviado'
                                  : rec.status === 'read'
                                    ? 'Respondido'
                                    : rec.status === 'error'
                                      ? 'Falha'
                                      : 'Pendente'}
                          </Badge>

                          {rec.status === 'waiting_approval' && (
                            <Button
                              size="sm"
                              onClick={() => handleApproveSingle(rec.id)}
                              className="h-7 px-2.5 rounded-lg text-[10px] bg-[#4F46E5] text-white"
                            >
                              Aprovar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 border border-[#E5E7EB] text-center space-y-3">
              <Send className="w-10 h-10 text-[#9CA3AF] mx-auto opacity-40" />
              <h3 className="text-sm font-bold text-[#111827]">Nenhuma campanha selecionada</h3>
              <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
                Selecione uma campanha à esquerda para visualizar métricas, destinatários e
                aprovações.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE CAMPAIGN MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 border border-[#E5E7EB] shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <div>
                <h2 className="text-base font-bold text-[#111827]">Nova Campanha de Disparos</h2>
                <p className="text-xs text-[#6B7280]">
                  Configure o conteúdo, audiência e parâmetros de segurança anti-ban.
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-[#9CA3AF] hover:text-[#111827] text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#374151]">
                  Título interno da campanha
                </label>
                <Input
                  placeholder="Ex: Reativação de Clientes Imóvel na Planta"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xs h-9 rounded-xl bg-[#F9FAFB]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#374151]">
                    Modelo de Mensagem (com variáveis)
                  </label>
                  <span className="text-[10px] text-[#6B7280]">
                    Variáveis:{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded">{'{{nome}}'}</code>,{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded">{'{{primeiro_nome}}'}</code>
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Escreva a mensagem personalizada..."
                />
              </div>

              {/* Audience selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#374151]">
                    Segmento de Audiência
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]"
                  >
                    <option value="all">Todos os contatos ({contacts.length})</option>
                    <option value="lead">Apenas Leads</option>
                    <option value="customer">Apenas Clientes</option>
                    <option value="partner">Apenas Parceiros</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#374151]">
                    Destinatários Elegíveis
                  </label>
                  <div className="h-9 px-3 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between text-xs text-indigo-900 font-semibold">
                    <span>Audiência estimada:</span>
                    <span>{audiencePreviewCount} contatos</span>
                  </div>
                </div>
              </div>

              {/* Anti-ban Throttling config */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  Controle Anti-Ban & Autonomia da IA
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-[#4B5563]">
                      Intervalo Mínimo (segundos)
                    </label>
                    <Input
                      type="number"
                      min={5}
                      value={minInterval}
                      onChange={(e) => setMinInterval(Number(e.target.value))}
                      className="text-xs h-8 bg-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#4B5563]">Intervalo Máximo (jitter)</label>
                    <Input
                      type="number"
                      min={10}
                      value={maxInterval}
                      onChange={(e) => setMaxInterval(Number(e.target.value))}
                      className="text-xs h-8 bg-white mt-1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="chkApproval"
                    checked={manualApproval}
                    onChange={(e) => setManualApproval(e.target.checked)}
                    className="rounded text-indigo-600 w-4 h-4"
                  />
                  <label htmlFor="chkApproval" className="text-xs text-slate-700 font-medium">
                    Exigir aprovação humana de cada mensagem antes do disparo (Recomendado - Modo 1)
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating}
                className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold gap-1.5"
              >
                {creating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Confirmar e Gerar Campanha
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
