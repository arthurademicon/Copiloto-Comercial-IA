import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  Sparkles,
  Smartphone,
  Calendar,
  Clock,
  Shield,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Bot,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/services/authContext'
import { messagingAdapter } from '@/services/messagingAdapter'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function Onboarding() {
  const { user, profile, refreshProfile, refreshWhatsapp } = useAuth()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)

  // Step 2 WA states: 'idle' | 'connecting' | 'waiting_qr' | 'connected' | 'error'
  const [waState, setWaState] = useState<
    'idle' | 'connecting' | 'waiting_qr' | 'connected' | 'error'
  >(profile?.whatsapp_connected ? 'connected' : 'idle')
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)
  const [waErrorMessage, setWaErrorMessage] = useState<string>('')
  const [isRealEvolution, setIsRealEvolution] = useState(false)

  // Step 3 Google Calendar states: 'idle' | 'connecting' | 'connected'
  const [calendarConnected, setCalendarConnected] = useState(
    profile?.google_calendar_connected || false,
  )
  const [isCalendarLoading, setIsCalendarLoading] = useState(false)

  // Step 4 Business hours
  const [businessHours, setBusinessHours] = useState([
    { day: 'Segunda-feira', start: '08:00', end: '18:00', enabled: true },
    { day: 'Terça-feira', start: '08:00', end: '18:00', enabled: true },
    { day: 'Quarta-feira', start: '08:00', end: '18:00', enabled: true },
    { day: 'Quinta-feira', start: '08:00', end: '18:00', enabled: true },
    { day: 'Sexta-feira', start: '08:00', end: '18:00', enabled: true },
    { day: 'Sábado', start: '09:00', end: '13:00', enabled: false },
    { day: 'Domingo', start: '00:00', end: '00:00', enabled: false },
  ])

  // Step 5 Autonomy mode: 'copilot' | 'copilot_automations' | 'autonomous_followup'
  const [autonomyMode, setAutonomyMode] = useState<
    'copilot' | 'copilot_automations' | 'autonomous_followup'
  >('copilot_automations')
  const [isFinishing, setIsFinishing] = useState(false)

  // Handle WA connection (Real Evolution QR Code or Demo)
  const handleConnectWhatsApp = async () => {
    if (!user) return
    setWaState('connecting')
    setWaErrorMessage('')
    try {
      const res = await messagingAdapter.connectInstance(user.id)
      setIsRealEvolution(!res.is_demo)

      if (res.status === 'connected') {
        setWaState('connected')
        await refreshWhatsapp()
        await refreshProfile()
        toast({
          title: 'WhatsApp Conectado com sucesso!',
          description: res.is_demo
            ? 'Instância em modo demonstração pronta para operar.'
            : 'Sessão WhatsApp autenticada com sucesso na Evolution API!',
        })
      } else if (res.status === 'waiting_qr' && res.qrcode) {
        setQrCodeData(res.qrcode)
        setWaState('waiting_qr')
        toast({
          title: 'QR Code Gerado',
          description: 'Abra o WhatsApp no celular e escaneie o código abaixo.',
        })
      } else if (res.status === 'error') {
        setWaState('error')
        setWaErrorMessage(res.error || 'Erro de autenticação na Evolution API')
      } else {
        // Fallback connecting
        setWaState('connected')
        await refreshWhatsapp()
        await refreshProfile()
      }
    } catch (err: unknown) {
      setWaState('error')
      setWaErrorMessage(err instanceof Error ? err.message : 'Falha ao conectar')
      toast({
        title: 'Erro ao conectar WhatsApp',
        variant: 'destructive',
      })
    }
  }

  // Handle Google Calendar simulation
  const handleConnectCalendar = async () => {
    if (!user) return
    setIsCalendarLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200))
      if (profile) {
        await pb.collection('user_profiles').update(profile.id, {
          google_calendar_connected: true,
        })
      }
      setCalendarConnected(true)
      toast({
        title: 'Google Agenda sincronizado',
        description: 'Horários livres mapeados para propostas de reunião.',
      })
    } finally {
      setIsCalendarLoading(false)
    }
  }

  // Handle finish
  const handleFinish = async () => {
    if (!profile) {
      navigate('/')
      return
    }
    setIsFinishing(true)
    try {
      await pb.collection('user_profiles').update(profile.id, {
        business_hours: businessHours,
        autonomy_mode: autonomyMode,
        whatsapp_connected: true,
        google_calendar_connected: calendarConnected,
      })
      await refreshProfile()
      toast({
        title: 'Configuração concluída!',
        description: 'Bem-vindo ao seu painel comercial inteligente.',
      })
      navigate('/')
    } catch {
      navigate('/')
    } finally {
      setIsFinishing(false)
    }
  }

  const steps = [
    { num: 1, label: 'Conta criada' },
    { num: 2, label: 'Conectar WhatsApp' },
    { num: 3, label: 'Google Agenda' },
    { num: 4, label: 'Horário comercial' },
    { num: 5, label: 'Modo de autonomia' },
  ]

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex flex-col justify-between p-4 md:p-8 font-sans text-[#111827]">
      {/* Brand Header */}
      <div className="max-w-3xl mx-auto w-full flex items-center justify-between pb-6 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="font-semibold text-base text-[#111827]">Copiloto Comercial IA</span>
            <span className="text-xs text-[#6B7280] block">Onboarding guiado do consultor</span>
          </div>
        </div>
        <div className="text-xs text-[#6B7280]">
          Passo <strong>{currentStep}</strong> de 5
        </div>
      </div>

      {/* Progress Circles */}
      <div className="max-w-2xl mx-auto w-full my-6">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#E5E7EB] -translate-y-1/2 z-0" />
          {steps.map((st) => (
            <div key={st.num} className="relative z-10 flex flex-col items-center">
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all border-2',
                  currentStep > st.num
                    ? 'bg-[#10B981] border-[#10B981] text-white'
                    : currentStep === st.num
                      ? 'bg-[#4F46E5] border-[#4F46E5] text-white shadow-md shadow-indigo-100'
                      : 'bg-white border-[#D1D5DB] text-[#9CA3AF]',
                )}
              >
                {currentStep > st.num ? <CheckCircle2 className="w-4 h-4" /> : st.num}
              </div>
              <span className="text-[11px] font-medium text-[#4B5563] mt-2 hidden sm:block text-center">
                {st.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Card Content Area */}
      <div className="max-w-2xl mx-auto w-full bg-white rounded-3xl p-6 md:p-8 border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.04)] my-auto">
        {/* STEP 1: CONTA CRIADA */}
        {currentStep === 1 && (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#10B981] flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#111827]">Conta configurada com sucesso!</h2>
              <p className="text-sm text-[#6B7280] max-w-md mx-auto mt-2 leading-relaxed">
                Bem-vindo ao Copiloto Comercial. Nas próximas 4 etapas vamos conectar seu WhatsApp,
                sincronizar sua agenda e alinhar como a IA atuará ao seu lado.
              </p>
            </div>
            <div className="p-4 bg-[#F9FAFB] rounded-2xl text-left border border-[#E5E7EB] max-w-md mx-auto space-y-2">
              <div className="text-xs font-medium text-[#374151]">
                Princípio norteador da plataforma:
              </div>
              <p className="text-xs text-[#6B7280] italic leading-relaxed">
                "A IA lembra, organiza, interpreta e recomenda. O vendedor constrói a relação e
                conduz a venda."
              </p>
            </div>
            <div className="pt-4">
              <Button
                onClick={() => setCurrentStep(2)}
                className="h-11 px-6 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-sm"
              >
                Avançar para Conexão
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: CONECTAR WHATSAPP */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#111827] flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#4F46E5]" />
                Conectar meu WhatsApp
              </h2>
              <p className="text-xs text-[#6B7280] mt-1">
                A conexão do WhatsApp é mandatória para o funcionamento do copiloto e análise em
                tempo real.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] text-center space-y-4">
              {waState === 'idle' && (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-white border border-[#E5E7EB] flex items-center justify-center mx-auto text-[#4F46E5] shadow-sm">
                    <Smartphone className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#111827]">Aguardando conexão</h3>
                    <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
                      Clique no botão abaixo para iniciar a instância comercial em modo
                      demonstração.
                    </p>
                  </div>
                  <Button
                    onClick={handleConnectWhatsApp}
                    className="h-11 px-6 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-medium text-sm"
                  >
                    Conectar meu WhatsApp
                  </Button>
                </>
              )}

              {waState === 'connecting' && (
                <div className="py-4 space-y-3">
                  <Loader2 className="w-8 h-8 text-[#4F46E5] animate-spin mx-auto" />
                  <h3 className="text-sm font-semibold text-[#111827]">Conectando...</h3>
                  <p className="text-xs text-[#6B7280]">
                    Inicializando camada Messaging Provider Adapter...
                  </p>
                </div>
              )}

              {waState === 'waiting_qr' && (
                <div className="py-3 space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center mx-auto">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#111827]">
                      Escaneie o QR Code no WhatsApp
                    </h3>
                    <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
                      Abra o WhatsApp no celular &gt; Dispositivos Conectados &gt; Conectar um
                      aparelho.
                    </p>
                  </div>
                  {qrCodeData && (
                    <div className="bg-white p-3 rounded-2xl border border-[#E5E7EB] inline-block shadow-sm">
                      <img
                        src={
                          qrCodeData.startsWith('data:')
                            ? qrCodeData
                            : `data:image/png;base64,${qrCodeData}`
                        }
                        alt="QR Code Evolution WhatsApp"
                        className="w-48 h-48 mx-auto object-contain"
                      />
                    </div>
                  )}
                  <div className="pt-2 flex justify-center gap-3">
                    <Button
                      onClick={handleConnectWhatsApp}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      <Loader2 className="w-3.5 h-3.5 mr-1" /> Atualizar QR Code
                    </Button>
                    <Button
                      onClick={async () => {
                        setWaState('connected')
                        await refreshWhatsapp()
                        await refreshProfile()
                      }}
                      size="sm"
                      className="bg-[#10B981] hover:bg-[#059669] text-white text-xs"
                    >
                      Já escaneei
                    </Button>
                  </div>
                </div>
              )}

              {waState === 'error' && (
                <div className="py-3 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-rose-100 text-[#EF4444] flex items-center justify-center mx-auto">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#EF4444]">Erro de autenticação</h3>
                  <p className="text-xs text-[#6B7280] max-w-md mx-auto">
                    {waErrorMessage || 'Não foi possível autenticar a sessão do WhatsApp.'}
                  </p>
                  <Button
                    onClick={handleConnectWhatsApp}
                    variant="outline"
                    className="text-xs mt-2"
                  >
                    Tentar Novamente
                  </Button>
                </div>
              )}

              {waState === 'connected' && (
                <div className="py-2 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#10B981] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#10B981]">
                    {isRealEvolution
                      ? 'WhatsApp Conectado (Evolution API)'
                      : 'WhatsApp Conectado (Modo Demo)'}
                  </h3>
                  <p className="text-xs text-[#6B7280]">
                    Instância ativa e pronta para ingerir conversas e gerar sugestões em tempo real.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => setCurrentStep(1)} className="text-xs">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
              </Button>
              <Button
                disabled={waState !== 'connected'}
                onClick={() => setCurrentStep(3)}
                className="h-10 px-5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-xs disabled:opacity-50"
              >
                Próxima etapa: Agenda
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: CONECTAR GOOGLE AGENDA */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#111827] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#4F46E5]" />
                Conectar Google Agenda
              </h2>
              <p className="text-xs text-[#6B7280] mt-1">
                Permite à IA consultar janelas livres e propor horários de reunião automaticamente
                ao cliente.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] text-center space-y-4">
              {!calendarConnected ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-white border border-[#E5E7EB] flex items-center justify-center mx-auto text-[#4F46E5] shadow-sm">
                    <Calendar className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#111827]">Google Calendar</h3>
                    <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
                      Sincronize com sua conta Google comercial para geração de slots de reunião.
                    </p>
                  </div>
                  <Button
                    onClick={handleConnectCalendar}
                    disabled={isCalendarLoading}
                    className="h-11 px-6 rounded-xl bg-white border border-[#D1D5DB] hover:bg-slate-50 text-[#374151] font-medium text-sm shadow-sm"
                  >
                    {isCalendarLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin text-[#4F46E5]" />
                        Sincronizando...
                      </>
                    ) : (
                      'Conectar Google Agenda'
                    )}
                  </Button>
                </>
              ) : (
                <div className="py-2 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#10B981] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#10B981]">
                    Agenda conectada com sucesso
                  </h3>
                  <p className="text-xs text-[#6B7280]">
                    Horários livres integrados para o fluxo de recomendação de reuniões.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => setCurrentStep(2)} className="text-xs">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
              </Button>
              <Button
                onClick={() => setCurrentStep(4)}
                className="h-10 px-5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-xs"
              >
                Próxima etapa: Horário Comercial
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: HORÁRIO COMERCIAL */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#111827] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#4F46E5]" />
                Grade de Horário Comercial
              </h2>
              <p className="text-xs text-[#6B7280] mt-1">
                A IA respeita sua janela de atendimento para sugestões de contato e automações.
              </p>
            </div>

            <div className="space-y-2 border border-[#E5E7EB] rounded-2xl p-4 bg-[#F9FAFB] max-h-64 overflow-y-auto">
              {businessHours.map((bh, idx) => (
                <div
                  key={bh.day}
                  className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-white border border-[#E5E7EB]"
                >
                  <div className="flex items-center gap-2 min-w-28">
                    <input
                      type="checkbox"
                      checked={bh.enabled}
                      onChange={(e) => {
                        const updated = [...businessHours]
                        updated[idx].enabled = e.target.checked
                        setBusinessHours(updated)
                      }}
                      className="rounded text-[#4F46E5] focus:ring-indigo-500"
                    />
                    <span
                      className={cn('font-medium', !bh.enabled && 'text-[#9CA3AF] line-through')}
                    >
                      {bh.day}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      disabled={!bh.enabled}
                      value={bh.start}
                      onChange={(e) => {
                        const updated = [...businessHours]
                        updated[idx].start = e.target.value
                        setBusinessHours(updated)
                      }}
                      className="border border-[#D1D5DB] rounded-lg px-2 py-1 text-xs disabled:opacity-40"
                    />
                    <span className="text-[#9CA3AF]">até</span>
                    <input
                      type="time"
                      disabled={!bh.enabled}
                      value={bh.end}
                      onChange={(e) => {
                        const updated = [...businessHours]
                        updated[idx].end = e.target.value
                        setBusinessHours(updated)
                      }}
                      className="border border-[#D1D5DB] rounded-lg px-2 py-1 text-xs disabled:opacity-40"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => setCurrentStep(3)} className="text-xs">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
              </Button>
              <Button
                onClick={() => setCurrentStep(5)}
                className="h-10 px-5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-xs"
              >
                Próxima etapa: Autonomia
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: MODO DE AUTONOMIA */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#111827] flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#4F46E5]" />
                Escolha do Modo de Autonomia
              </h2>
              <p className="text-xs text-[#6B7280] mt-1">
                Controle o nível de independência da IA. Você pode alterar isso a qualquer momento
                nas Configurações.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Card 1: Copiloto */}
              <div
                onClick={() => setAutonomyMode('copilot')}
                className={cn(
                  'cursor-pointer p-4 rounded-2xl border transition-all text-left flex items-start gap-3.5',
                  autonomyMode === 'copilot'
                    ? 'border-[#4F46E5] bg-[#EEF2FF]/40 shadow-sm'
                    : 'border-[#E5E7EB] hover:border-slate-300 bg-white',
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                    autonomyMode === 'copilot'
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-slate-100 text-[#6B7280]',
                  )}
                >
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#111827]">1. Copiloto (Puro)</span>
                    {autonomyMode === 'copilot' && (
                      <span className="text-[11px] font-semibold text-[#4F46E5]">Selecionado</span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                    A IA apenas recomenda e sugere. Nenhuma mensagem ou tarefa é executada sem o seu
                    clique explícito.
                  </p>
                </div>
              </div>

              {/* Card 2: Copiloto + Automações Aprovadas */}
              <div
                onClick={() => setAutonomyMode('copilot_automations')}
                className={cn(
                  'cursor-pointer p-4 rounded-2xl border transition-all text-left flex items-start gap-3.5',
                  autonomyMode === 'copilot_automations'
                    ? 'border-[#4F46E5] bg-[#EEF2FF]/40 shadow-sm'
                    : 'border-[#E5E7EB] hover:border-slate-300 bg-white',
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                    autonomyMode === 'copilot_automations'
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-slate-100 text-[#6B7280]',
                  )}
                >
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#111827]">
                      2. Copiloto + Automações Aprovadas
                    </span>
                    {autonomyMode === 'copilot_automations' && (
                      <span className="text-[11px] font-semibold text-[#4F46E5]">Recomendado</span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                    A IA prepara follow-ups, cria lembretes de agenda e tarefas. Mensagens para
                    clientes ainda exigem sua aprovação.
                  </p>
                </div>
              </div>

              {/* Card 3: Follow-up Autônomo */}
              <div
                onClick={() => setAutonomyMode('autonomous_followup')}
                className={cn(
                  'cursor-pointer p-4 rounded-2xl border transition-all text-left flex items-start gap-3.5',
                  autonomyMode === 'autonomous_followup'
                    ? 'border-[#4F46E5] bg-[#EEF2FF]/40 shadow-sm'
                    : 'border-[#E5E7EB] hover:border-slate-300 bg-white',
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                    autonomyMode === 'autonomous_followup'
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-slate-100 text-[#6B7280]',
                  )}
                >
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#111827]">
                      3. Follow-up Autônomo
                    </span>
                    {autonomyMode === 'autonomous_followup' && (
                      <span className="text-[11px] font-semibold text-[#4F46E5]">Selecionado</span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                    Envia retornos agendados com alta confiança (≥80%) de forma autônoma. Ações
                    sensíveis (preço, propostas) continuam manuais.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => setCurrentStep(4)} className="text-xs">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
              </Button>
              <Button
                onClick={handleFinish}
                disabled={isFinishing}
                className="h-11 px-6 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-sm transition-all"
              >
                {isFinishing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  <>
                    Concluir configuração
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-[#9CA3AF] py-2">
        Copiloto Comercial IA — Ambiente homologado Skip Cloud
      </div>
    </div>
  )
}
