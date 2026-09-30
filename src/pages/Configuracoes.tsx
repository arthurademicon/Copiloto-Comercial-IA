import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  User,
  QrCode,
  Calendar,
  Clock,
  ShieldCheck,
  Bell,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Smartphone,
  ExternalLink,
  Save,
  Loader2,
  Lock,
  Cpu,
  Key,
  Globe,
  Radio,
} from 'lucide-react'
import { useAuth } from '@/services/authContext'
import { messagingAdapter } from '@/services/messagingAdapter'
import { aiProviderService, type AvailableAiProvider } from '@/services/aiProviderService'
import pb from '@/lib/pocketbase/client'
import type { AutonomyMode, WhatsappStatus, EvolutionConfigStatus, AiConfig } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type TabKey = 'perfil' | 'conexoes' | 'ia' | 'horario' | 'autonomia' | 'notificacoes'

export default function Configuracoes() {
  const { user, profile, whatsappInstance, refreshProfile, refreshWhatsapp } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabKey) || 'perfil'
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)

  // Profile form
  const [name, setName] = useState(user?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Connections state (Evolution real + Google Calendar)
  const [waLoading, setWaLoading] = useState(false)
  const [evoConfig, setEvoConfig] = useState<EvolutionConfigStatus | null>(null)
  const [evoBaseUrl, setEvoBaseUrl] = useState('')
  const [evoApiKey, setEvoApiKey] = useState('')
  const [evoInstanceName, setEvoInstanceName] = useState('copiloto-ademicon')
  const [savingEvo, setSavingEvo] = useState(false)
  const [qrModalCode, setQrModalCode] = useState<string | null>(null)

  // AI Pluggable Provider state
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    provider: 'skip_agent',
    model: 'commercial-copilot',
    temperature: 0.7,
  })
  const [availableAiProviders, setAvailableAiProviders] = useState<AvailableAiProvider[]>([])
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiCustomEndpoint, setAiCustomEndpoint] = useState('')
  const [savingAi, setSavingAi] = useState(false)

  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(
    Boolean(profile?.google_calendar_connected),
  )

  // Business hours state
  const defaultHours = [
    { day: 'Segunda-feira', start: '08:00', end: '18:00', enabled: true },
    { day: 'Terça-feira', start: '08:00', end: '18:00', enabled: true },
    { day: 'Quarta-feira', start: '08:00', end: '18:00', enabled: true },
    { day: 'Quinta-feira', start: '08:00', end: '18:00', enabled: true },
    { day: 'Sexta-feira', start: '08:00', end: '18:00', enabled: true },
    { day: 'Sábado', start: '09:00', end: '13:00', enabled: false },
    { day: 'Domingo', start: '00:00', end: '00:00', enabled: false },
  ]
  const [businessHours, setBusinessHours] = useState(profile?.business_hours || defaultHours)
  const [savingHours, setSavingHours] = useState(false)

  // Autonomy Mode state
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>(
    profile?.autonomy_mode || 'copilot',
  )
  const [savingAutonomy, setSavingAutonomy] = useState(false)

  // Notification Preferences state
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    whatsappAlerts: true,
    overdueWarning: true,
    meetingReminder: true,
  })
  const [savingNotifications, setSavingNotifications] = useState(false)

  useEffect(() => {
    const tab = searchParams.get('tab') as TabKey
    if (tab && ['perfil', 'conexoes', 'ia', 'horario', 'autonomia', 'notificacoes'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Load Evolution and AI settings
  useEffect(() => {
    async function loadIntegrations() {
      try {
        const evo = await messagingAdapter.getProviderConfig()
        setEvoConfig(evo)
        setEvoBaseUrl(evo.base_url)
        setEvoInstanceName(evo.instance_name || 'copiloto-ademicon')
        if (evo.has_api_key) {
          setEvoApiKey(evo.api_key_masked)
        }
      } catch {
        /* intentionally ignored */
      }

      try {
        const aiData = await aiProviderService.getConfig()
        setAiConfig(aiData.config)
        setAvailableAiProviders(aiData.available_providers)
        if (aiData.config.custom_endpoint) {
          setAiCustomEndpoint(aiData.config.custom_endpoint)
        }
      } catch {
        /* intentionally ignored */
      }
    }
    loadIntegrations()
  }, [])

  useEffect(() => {
    if (user?.name) setName(user.name)
    if (profile?.business_hours) setBusinessHours(profile.business_hours)
    if (profile?.autonomy_mode) setAutonomyMode(profile.autonomy_mode)
    if (profile?.google_calendar_connected !== undefined) {
      setGoogleCalendarConnected(Boolean(profile.google_calendar_connected))
    }
  }, [user, profile])

  const handleTabChange = (t: TabKey) => {
    setActiveTab(t)
    setSearchParams({ tab: t })
  }

  const getInitials = (fullName?: string) => {
    if (!fullName) return 'CC'
    const parts = fullName.trim().split(' ')
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // 1. Save Profile
  const handleSaveProfile = async () => {
    if (!user) return
    setSavingProfile(true)
    try {
      await pb.collection('users').update(user.id, { name })
      toast({ title: 'Perfil atualizado com sucesso!' })
      await refreshProfile()
    } catch {
      toast({ title: 'Erro ao salvar perfil', variant: 'destructive' })
    } finally {
      setSavingProfile(false)
    }
  }

  // 2. WhatsApp connection handlers
  const waStatus: WhatsappStatus = profile?.whatsapp_connected
    ? 'connected'
    : whatsappInstance?.status || 'disconnected'

  const handleToggleWhatsApp = async () => {
    if (!user) return
    setWaLoading(true)
    try {
      if (waStatus === 'connected' && whatsappInstance?.id) {
        await messagingAdapter.disconnectInstance(whatsappInstance.id)
        toast({ title: 'WhatsApp desconectado com sucesso.' })
      } else {
        await messagingAdapter.connectInstance(user.id)
        toast({
          title: 'WhatsApp conectado com sucesso!',
          description: 'Sessão demo iniciada no navegador.',
        })
      }
      await refreshProfile()
      await refreshWhatsapp()
    } catch {
      toast({ title: 'Erro ao alterar estado do WhatsApp', variant: 'destructive' })
    } finally {
      setWaLoading(false)
    }
  }

  const handleToggleGoogleCalendar = async () => {
    if (!profile) return
    const newState = !googleCalendarConnected
    setGoogleCalendarConnected(newState)
    try {
      await pb.collection('user_profiles').update(profile.id, {
        google_calendar_connected: newState,
      })
      toast({
        title: newState ? 'Google Agenda conectado!' : 'Google Agenda desconectado.',
        description: newState
          ? 'Reuniões agora são sincronizadas internamente com id do calendário.'
          : '',
      })
      await refreshProfile()
    } catch {
      setGoogleCalendarConnected(!newState)
      toast({ title: 'Erro ao atualizar conexão da agenda', variant: 'destructive' })
    }
  }

  // 3. Save Business Hours
  const handleSaveHours = async () => {
    if (!profile) return
    setSavingHours(true)
    try {
      await pb.collection('user_profiles').update(profile.id, {
        business_hours: businessHours,
      })
      toast({ title: 'Horário comercial atualizado com sucesso!' })
      await refreshProfile()
    } catch {
      toast({ title: 'Erro ao salvar horário comercial', variant: 'destructive' })
    } finally {
      setSavingHours(false)
    }
  }

  // 4. Save Autonomy Mode
  const handleSaveAutonomy = async (newMode: AutonomyMode) => {
    if (!profile) return
    setAutonomyMode(newMode)
    setSavingAutonomy(true)
    try {
      await pb.collection('user_profiles').update(profile.id, {
        autonomy_mode: newMode,
      })
      toast({
        title: 'Modo de autonomia atualizado!',
        description:
          newMode === 'copilot'
            ? 'A IA atuará apenas com recomendações consultivas.'
            : newMode === 'copilot_automations'
              ? 'Agendamentos podem ser automatizados; textos de mensagens exigem aprovação.'
              : 'Follow-ups autorizados são enviados automaticamente.',
      })
      await refreshProfile()
    } catch {
      toast({ title: 'Erro ao alterar autonomia', variant: 'destructive' })
    } finally {
      setSavingAutonomy(false)
    }
  }

  // 5. Save Notifications
  const handleSaveNotifications = async () => {
    setSavingNotifications(true)
    setTimeout(() => {
      setSavingNotifications(false)
      toast({ title: 'Preferências de notificação salvas!' })
    }, 400)
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Configurações da Conta</h1>
        <p className="text-xs text-[#6B7280] mt-1">
          Gerencie seu perfil, integrações de canais, agenda, horário de atendimento e autonomia do
          Copiloto IA.
        </p>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'perfil', label: 'Perfil', icon: User },
          { id: 'conexoes', label: 'Conexões & Integrações', icon: QrCode },
          { id: 'ia', label: 'Camada de IA (Plugável)', icon: Cpu },
          { id: 'horario', label: 'Horário Comercial', icon: Clock },
          { id: 'autonomia', label: 'Autonomia da IA', icon: ShieldCheck },
          { id: 'notificacoes', label: 'Notificações', icon: Bell },
        ].map((t) => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id as TabKey)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold border border-indigo-200'
                  : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-100',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: PERFIL */}
      {activeTab === 'perfil' && (
        <div className="bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-6">
          <div className="flex items-center gap-4 pb-6 border-b border-[#E5E7EB]">
            <div className="w-16 h-16 rounded-2xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center font-bold text-xl border-2 border-indigo-100">
              {getInitials(name || user?.email)}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#111827]">
                {name || 'Consultor Comercial'}
              </h2>
              <p className="text-xs text-[#6B7280]">{user?.email}</p>
              <Badge variant="outline" className="mt-1 text-[10px] capitalize bg-slate-50">
                Função: {profile?.role || 'consultor'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#374151]">Nome completo</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="text-xs h-10 rounded-xl bg-[#F9FAFB]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#374151]">E-mail de acesso</label>
              <Input
                value={user?.email || ''}
                disabled
                className="text-xs h-10 rounded-xl bg-slate-100 text-[#6B7280]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] flex justify-end">
            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="h-9 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold gap-1.5"
            >
              {savingProfile ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Salvar Alterações
            </Button>
          </div>
        </div>
      )}

      {/* TAB 2: CONEXÕES & INTEGRAÇÕES */}
      {activeTab === 'conexoes' && (
        <div className="space-y-6">
          {/* WhatsApp Card */}
          <div className="bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#10B981] flex items-center justify-center border border-emerald-100">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                    WhatsApp (Messaging Provider Adapter)
                  </h3>
                  <p className="text-xs text-[#6B7280]">
                    Canal principal de ingestão de mensagens e disparo de ações sugeridas.
                  </p>
                </div>
              </div>

              <div>
                {waStatus === 'connected' ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2.5 py-0.5"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                    WhatsApp Conectado
                  </Badge>
                ) : waStatus === 'connecting' ? (
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-2.5 py-0.5"
                  >
                    <Loader2 className="w-3 h-3 mr-1 inline animate-spin" />
                    Conectando...
                  </Badge>
                ) : waStatus === 'error' ? (
                  <Badge
                    variant="outline"
                    className="bg-rose-50 text-rose-700 border-rose-200 text-xs px-2.5 py-0.5"
                  >
                    <AlertTriangle className="w-3 h-3 mr-1 inline" />
                    Erro de autenticação
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-slate-100 text-[#6B7280] text-xs px-2.5 py-0.5"
                  >
                    Aguardando conexão
                  </Badge>
                )}
              </div>
            </div>

            <div className="p-4 bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] text-xs text-[#374151] space-y-2">
              <div className="flex items-center justify-between">
                <span>Modo de execução:</span>
                <span className="font-semibold text-[#111827]">
                  Ambiente Demo (Simulador Ativo)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Instância:</span>
                <span className="font-mono text-[#6B7280]">
                  {whatsappInstance?.instance_name || 'Instância Comercial'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Idempotência de mensagens:</span>
                <span className="text-emerald-700 font-semibold">
                  Ativa (chave única por evento)
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-[#6B7280]">
                {waStatus === 'connected'
                  ? 'Instância operacional. O simulador injeta mensagens demo periodicamente.'
                  : 'Conecte para sincronizar as mensagens e permitir as análises do Copiloto.'}
              </span>
              <Button
                onClick={handleToggleWhatsApp}
                disabled={waLoading}
                variant={waStatus === 'connected' ? 'outline' : 'default'}
                className={cn(
                  'h-9 px-4 rounded-xl text-xs font-semibold gap-1.5',
                  waStatus === 'connected'
                    ? 'hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                    : 'bg-[#4F46E5] hover:bg-[#4338CA] text-white',
                )}
              >
                {waLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : waStatus === 'connected' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" /> Desconectar Instância
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" /> Reconectar WhatsApp
                  </>
                )}
              </Button>
            </div>

            {/* QR Code display inside settings if waiting */}
            {qrModalCode && (
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-center space-y-3">
                <span className="text-xs font-bold text-indigo-900 block">
                  Escaneie para parear com a Evolution API
                </span>
                <img
                  src={
                    qrModalCode.startsWith('data:')
                      ? qrModalCode
                      : `data:image/png;base64,${qrModalCode}`
                  }
                  alt="QR Code Evolution"
                  className="w-44 h-44 mx-auto object-contain bg-white p-2 rounded-xl border border-indigo-200"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQrModalCode(null)}
                  className="text-xs"
                >
                  Fechar QR Code
                </Button>
              </div>
            )}

            {/* Evolution API Connection Settings Form (Admin/Gestor) */}
            <div className="mt-4 pt-4 border-t border-[#E5E7EB] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-600" />
                    Parâmetros da Evolution API (VPS Privada)
                  </h4>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">
                    Enquanto estes campos estiverem vazios, o sistema opera automaticamente em modo
                    demonstração.
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {evoConfig?.is_configured ? 'Evolution Ativa' : 'Modo Demo Ativo'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#374151]">
                    URL Base Evolution
                  </label>
                  <Input
                    placeholder="https://evolution.sua-vps.com"
                    value={evoBaseUrl}
                    onChange={(e) => setEvoBaseUrl(e.target.value)}
                    className="text-xs h-9 rounded-xl bg-[#F9FAFB]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#374151]">
                    Evolution API Key
                  </label>
                  <Input
                    type="password"
                    placeholder="Ex: 42964aa2..."
                    value={evoApiKey}
                    onChange={(e) => setEvoApiKey(e.target.value)}
                    className="text-xs h-9 rounded-xl bg-[#F9FAFB]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#374151]">
                    Nome da Instância
                  </label>
                  <Input
                    placeholder="Ex: copiloto-ademicon"
                    value={evoInstanceName}
                    onChange={(e) => setEvoInstanceName(e.target.value)}
                    className="text-xs h-9 rounded-xl bg-[#F9FAFB]"
                  />
                </div>
              </div>

              {/* Webhook Endpoint Info Box */}
              <div className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs space-y-1.5 font-mono">
                <div className="text-[11px] text-indigo-300 font-sans font-semibold flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  URL do Webhook para apontar na VPS da Evolution:
                </div>
                <div className="bg-slate-800 p-2 rounded-lg text-emerald-400 select-all overflow-x-auto text-[11px]">
                  {import.meta.env.VITE_POCKETBASE_URL}/backend/v1/webhook/evolution
                </div>
                <div className="text-[10px] text-slate-400 font-sans">
                  Eventos recomendados no painel/API da Evolution:{' '}
                  <span className="text-slate-200">MESSAGES_UPSERT, CONNECTION_UPDATE</span>.
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={async () => {
                    setSavingEvo(true)
                    try {
                      const ok = await messagingAdapter.saveProviderConfig({
                        base_url: evoBaseUrl,
                        api_key: evoApiKey,
                        instance_name: evoInstanceName,
                      })
                      if (ok) {
                        toast({ title: 'Configurações da Evolution API salvas com sucesso!' })
                        const updated = await messagingAdapter.getProviderConfig()
                        setEvoConfig(updated)
                      } else {
                        toast({ title: 'Erro ao salvar credenciais', variant: 'destructive' })
                      }
                    } finally {
                      setSavingEvo(false)
                    }
                  }}
                  disabled={savingEvo}
                  className="h-8 px-3 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold gap-1"
                >
                  {savingEvo ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  Salvar Conexão Evolution
                </Button>
              </div>
            </div>
          </div>

          {/* Google Calendar Card */}
          <div className="bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center border border-indigo-100">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#111827]">Google Agenda</h3>
                  <p className="text-xs text-[#6B7280]">
                    Sincroniza reuniões geradas pelo Copiloto diretamente no calendário comercial.
                  </p>
                </div>
              </div>

              <div>
                {googleCalendarConnected ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2.5 py-0.5"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                    Conectado
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-slate-100 text-[#6B7280] text-xs px-2.5 py-0.5"
                  >
                    Não conectado
                  </Badge>
                )}
              </div>
            </div>

            <div className="p-4 bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] text-xs text-[#4B5563]">
              No modo MVP demo, a agenda utiliza a base interna do sistema com mapeamento para
              calendar_event_id, garantindo disponibilidade de slots sem dependência de OAuth
              externo complexo.
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-[#6B7280]">
                {googleCalendarConnected
                  ? 'Acesso sincronizado à agenda do consultor.'
                  : 'Conecte para sugerir horários automaticamente na conversa.'}
              </span>
              <Button
                onClick={handleToggleGoogleCalendar}
                variant="outline"
                className="h-9 px-4 rounded-xl text-xs font-semibold"
              >
                {googleCalendarConnected ? 'Desconectar Agenda' : 'Conectar Google Agenda'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CAMADA DE IA PLUGÁVEL (NOVO) */}
      {activeTab === 'ia' && (
        <div className="bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#4F46E5]" />
                Camada de Inteligência Artificial Plugável
              </h2>
              <p className="text-xs text-[#6B7280] mt-1">
                Alterne o provedor e modelo de IA da sua organização sem alterar o cérebro comercial
                ou as regras de negócio.
              </p>
            </div>
            <Badge className="bg-indigo-50 text-[#4F46E5] border border-indigo-200 text-xs">
              Provider-Agnostic
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableAiProviders.map((prov) => {
              const isSelected = aiConfig.provider === prov.id
              return (
                <div
                  key={prov.id}
                  onClick={() =>
                    setAiConfig((prev) => ({
                      ...prev,
                      provider: prov.id,
                      model: prov.models[0] || '',
                    }))
                  }
                  className={cn(
                    'p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 flex flex-col justify-between',
                    isSelected
                      ? 'border-[#4F46E5] bg-[#EEF2FF]/40 shadow-sm'
                      : 'border-[#E5E7EB] hover:bg-slate-50',
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-[#111827]">{prov.name}</span>
                      {isSelected && (
                        <span className="text-[10px] font-bold text-[#4F46E5] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> ATIVO
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#6B7280] leading-relaxed">{prov.description}</p>
                  </div>
                  <div className="pt-2 flex flex-wrap gap-1">
                    {prov.models.map((m) => (
                      <Badge
                        key={m}
                        variant="secondary"
                        className={cn(
                          'text-[10px] font-mono',
                          aiConfig.model === m && 'bg-[#4F46E5] text-white',
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          setAiConfig((prev) => ({ ...prev, provider: prov.id, model: m }))
                        }}
                      >
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Conditional custom API Key / endpoint form for external providers */}
          {aiConfig.provider !== 'skip_agent' && (
            <div className="p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl space-y-4">
              <h4 className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-600" />
                Credenciais do Provedor Selecionado ({aiConfig.provider})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#374151]">
                    API Key do Provedor
                  </label>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    className="text-xs h-9 rounded-xl bg-white"
                  />
                  <span className="text-[10px] text-[#6B7280]">
                    A chave é criptografada e nunca exposta em texto plano no cliente.
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#374151]">
                    Endpoint Customizado (Opcional)
                  </label>
                  <Input
                    placeholder="https://api.openai.com/v1 ou proxy"
                    value={aiCustomEndpoint}
                    onChange={(e) => setAiCustomEndpoint(e.target.value)}
                    className="text-xs h-9 rounded-xl bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-between">
            <span className="text-xs text-[#6B7280]">
              Provedor ativo:{' '}
              <strong className="text-[#111827]">
                {aiConfig.provider} ({aiConfig.model})
              </strong>
            </span>
            <Button
              onClick={async () => {
                setSavingAi(true)
                try {
                  const res = await aiProviderService.saveConfig({
                    provider: aiConfig.provider,
                    model: aiConfig.model,
                    api_key: aiApiKey,
                    custom_endpoint: aiCustomEndpoint,
                  })
                  if (res.ok) {
                    toast({ title: 'Provedor de IA atualizado com sucesso!' })
                  } else {
                    toast({ title: res.error || 'Erro ao salvar', variant: 'destructive' })
                  }
                } finally {
                  setSavingAi(false)
                }
              }}
              disabled={savingAi}
              className="h-9 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold gap-1.5"
            >
              {savingAi ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Salvar Configuração de IA
            </Button>
          </div>
        </div>
      )}

      {/* TAB 3: HORÁRIO COMERCIAL */}
      {activeTab === 'horario' && (
        <div className="bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-6">
          <div>
            <h2 className="text-base font-bold text-[#111827]">Horário de Atendimento Comercial</h2>
            <p className="text-xs text-[#6B7280] mt-1">
              O Copiloto IA respeita estas janelas para sugerir reuniões com clientes e evitar
              disparos fora do expediente.
            </p>
          </div>

          <div className="space-y-3">
            {businessHours.map((bh, idx) => (
              <div
                key={bh.day}
                className={cn(
                  'p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors',
                  bh.enabled
                    ? 'bg-white border-[#E5E7EB]'
                    : 'bg-[#F9FAFB] border-[#E5E7EB]/60 opacity-60',
                )}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={bh.enabled !== false}
                    onChange={(e) => {
                      const updated = [...businessHours]
                      updated[idx] = { ...updated[idx], enabled: e.target.checked }
                      setBusinessHours(updated)
                    }}
                    className="w-4 h-4 rounded text-[#4F46E5] focus:ring-indigo-500"
                  />
                  <span className="text-xs font-semibold text-[#111827] w-28">{bh.day}</span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#6B7280]">Das</span>
                  <input
                    type="time"
                    disabled={!bh.enabled}
                    value={bh.start}
                    onChange={(e) => {
                      const updated = [...businessHours]
                      updated[idx] = { ...updated[idx], start: e.target.value }
                      setBusinessHours(updated)
                    }}
                    className="border border-[#E5E7EB] rounded-lg px-2 py-1 text-xs bg-white"
                  />
                  <span className="text-[#6B7280]">às</span>
                  <input
                    type="time"
                    disabled={!bh.enabled}
                    value={bh.end}
                    onChange={(e) => {
                      const updated = [...businessHours]
                      updated[idx] = { ...updated[idx], end: e.target.value }
                      setBusinessHours(updated)
                    }}
                    className="border border-[#E5E7EB] rounded-lg px-2 py-1 text-xs bg-white"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] flex justify-end">
            <Button
              onClick={handleSaveHours}
              disabled={savingHours}
              className="h-9 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold gap-1.5"
            >
              {savingHours ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Salvar Horários
            </Button>
          </div>
        </div>
      )}

      {/* TAB 4: AUTONOMIA DA IA (3 MODOS + REGRAS CRÍTICAS) */}
      {activeTab === 'autonomia' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#111827]">
                Níveis de Autonomia do Copiloto Comercial
              </h2>
              <p className="text-xs text-[#6B7280] mt-1">
                Defina com precisão o nível de liberdade operacional da inteligência artificial nas
                suas conversas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Modo 1 */}
              <div
                onClick={() => handleSaveAutonomy('copilot')}
                className={cn(
                  'p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 flex flex-col justify-between',
                  autonomyMode === 'copilot'
                    ? 'border-[#4F46E5] bg-[#EEF2FF]/40 shadow-sm'
                    : 'border-[#E5E7EB] hover:bg-slate-50',
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-[10px] bg-white">
                      Modo 1
                    </Badge>
                    {autonomyMode === 'copilot' && (
                      <span className="text-[10px] font-bold text-[#4F46E5]">ATIVO</span>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-[#111827]">COPILOTO</h3>
                  <p className="text-[11px] text-[#6B7280] mt-1 leading-relaxed">
                    A IA apenas recomenda e sugere. Nenhuma ação, lembrete ou mensagem é enviada sem
                    que o consultor clique em "Aceitar" ou "Enviar".
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200/60 text-[10px] text-[#4F46E5] font-medium">
                  Ideal para iniciantes
                </div>
              </div>

              {/* Modo 2 */}
              <div
                onClick={() => handleSaveAutonomy('copilot_automations')}
                className={cn(
                  'p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 flex flex-col justify-between',
                  autonomyMode === 'copilot_automations'
                    ? 'border-[#4F46E5] bg-[#EEF2FF]/40 shadow-sm'
                    : 'border-[#E5E7EB] hover:bg-slate-50',
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-[10px] bg-white">
                      Modo 2
                    </Badge>
                    {autonomyMode === 'copilot_automations' && (
                      <span className="text-[10px] font-bold text-[#4F46E5]">ATIVO</span>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-[#111827]">COPILOTO + AUTOMAÇÕES</h3>
                  <p className="text-[11px] text-[#6B7280] mt-1 leading-relaxed">
                    A IA pode agendar tarefas, criar lembretes internos e registrar eventos na
                    agenda, mas qualquer mensagem direcionada ao cliente exige aprovação prévia.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200/60 text-[10px] text-indigo-600 font-medium">
                  Produtividade equilibrada
                </div>
              </div>

              {/* Modo 3 */}
              <div
                onClick={() => handleSaveAutonomy('autonomous_followup')}
                className={cn(
                  'p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 flex flex-col justify-between',
                  autonomyMode === 'autonomous_followup'
                    ? 'border-[#4F46E5] bg-[#EEF2FF]/40 shadow-sm'
                    : 'border-[#E5E7EB] hover:bg-slate-50',
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-[10px] bg-white">
                      Modo 3
                    </Badge>
                    {autonomyMode === 'autonomous_followup' && (
                      <span className="text-[10px] font-bold text-[#4F46E5]">ATIVO</span>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-[#111827]">FOLLOW-UP AUTÔNOMO</h3>
                  <p className="text-[11px] text-[#6B7280] mt-1 leading-relaxed">
                    A IA envia categorias autorizadas de follow-up de rotina automaticamente quando
                    o cliente não responde no prazo acordado.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200/60 text-[10px] text-purple-700 font-medium">
                  Escala máxima com proteção
                </div>
              </div>
            </div>
          </div>

          {/* Regras Críticas de Proteção (NUNCA AUTOMÁTICAS) */}
          <div className="bg-white rounded-3xl p-6 border-2 border-rose-200/80 bg-rose-50/15 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-700">
              <Lock className="w-4 h-4 text-rose-600" />
              Regras Críticas de Segurança Institucional (Trava Rígida)
            </div>
            <p className="text-xs text-[#374151] leading-relaxed">
              Mesmo no modo <strong>Follow-up Autônomo</strong>, os seguintes tópicos{' '}
              <strong>NUNCA</strong> são enviados de forma automática e obrigatoriamente exigem
              validação e aprovação do consultor humano:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
              {[
                'Promessas ou garantias de contemplação de cota',
                'Condições comerciais não confirmadas oficialmente',
                'Negociações excepcionais ou descontos fora de tabela',
                'Alterações de preço ou taxas administrativas',
                'Compromissos contratuais formais',
                'Afirmações técnicas ou regulatórias fora da base de conhecimento',
                'Situações de insatisfação sensíveis ou conflito',
                'Pedido explícito para falar com o responsável humano',
                'Informações financeiras e dados bancários',
              ].map((item, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-white border border-rose-100 flex items-start gap-2 text-xs text-[#374151]"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PREFERÊNCIAS DE NOTIFICAÇÃO */}
      {activeTab === 'notificacoes' && (
        <div className="bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-6">
          <div>
            <h2 className="text-base font-bold text-[#111827]">
              Preferências de Alerta & Notificação
            </h2>
            <p className="text-xs text-[#6B7280] mt-1">
              Personalize como você deseja ser avisado sobre movimentações urgentes e follow-ups
              vencidos.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                id: 'overdueWarning',
                title: 'Alertas de Follow-ups Vencidos',
                desc: 'Avisar imediatamente quando uma oportunidade ultrapassar a data combinada sem retorno.',
              },
              {
                id: 'meetingReminder',
                title: 'Lembretes de Reuniões Próximas',
                desc: 'Avisar 30 minutos antes de encontros agendados via Google Agenda.',
              },
              {
                id: 'emailAlerts',
                title: 'Resumo Diário por E-mail',
                desc: 'Receber todo início de manhã a lista das 5 ações prioritárias do dia.',
              },
              {
                id: 'whatsappAlerts',
                title: 'Avisos de Novas Mensagens Quentes',
                desc: 'Notificar quando a IA detectar alta intenção de compra ou pedido de proposta.',
              },
            ].map((n) => (
              <div
                key={n.id}
                className="p-3.5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between gap-4"
              >
                <div>
                  <h4 className="text-xs font-semibold text-[#111827]">{n.title}</h4>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">{n.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications[n.id as keyof typeof notifications]}
                  onChange={(e) =>
                    setNotifications((prev) => ({ ...prev, [n.id]: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-[#4F46E5] focus:ring-indigo-500"
                />
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] flex justify-end">
            <Button
              onClick={handleSaveNotifications}
              disabled={savingNotifications}
              className="h-9 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold gap-1.5"
            >
              {savingNotifications ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Salvar Preferências
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
