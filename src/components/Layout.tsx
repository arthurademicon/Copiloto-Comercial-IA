import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard,
  MessageSquare,
  Kanban,
  Clock,
  Calendar,
  Sparkles,
  BookOpen,
  BarChart3,
  Users,
  Settings,
  Bell,
  LogOut,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Info,
  Send,
} from 'lucide-react'
import { useAuth } from '@/services/authContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export default function Layout() {
  const { user, profile, whatsappInstance, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [alertsOpen, setAlertsOpen] = useState(false)

  // Prioritized alerts
  const isWaConnected = profile?.whatsapp_connected || whatsappInstance?.status === 'connected'
  const alerts = [
    ...(!isWaConnected
      ? [
          {
            id: 'alt_wa',
            priority: 'CRITICA' as const,
            title: 'WhatsApp desconectado',
            description: 'Conecte sua instância para habilitar o copiloto em tempo real.',
            action: () => navigate('/configuracoes?tab=conexoes'),
          },
        ]
      : []),
    {
      id: 'alt_fu',
      priority: 'ACAO_NECESSARIA' as const,
      title: 'Follow-ups pendentes hoje',
      description: 'Você possui oportunidades aguardando retorno agendado.',
      action: () => navigate('/followups'),
    },
    {
      id: 'alt_opp',
      priority: 'OPORTUNIDADE' as const,
      title: 'Intenção de reunião detectada',
      description: 'Roberto Lima solicitou horário nesta semana.',
      action: () => navigate('/conversas'),
    },
  ]

  const criticalAndActionCount = alerts.filter(
    (a) => a.priority === 'CRITICA' || a.priority === 'ACAO_NECESSARIA',
  ).length

  const isManagerOrAdmin = profile?.role === 'gestor' || profile?.role === 'admin'

  const navItems = [
    { label: 'Início', path: '/', icon: LayoutDashboard },
    { label: 'Conversas', path: '/conversas', icon: MessageSquare },
    { label: 'Pipeline', path: '/pipeline', icon: Kanban },
    { label: 'Follow-ups', path: '/followups', icon: Clock },
    { label: 'Agenda', path: '/agenda', icon: Calendar },
    { label: 'Disparos', path: '/disparos', icon: Send },
    { label: 'Copiloto', path: '/copiloto', icon: Sparkles },
    { label: 'Conhecimento', path: '/conhecimento', icon: BookOpen },
    { label: 'Relatórios', path: '/relatorios', icon: BarChart3 },
    ...(isManagerOrAdmin ? [{ label: 'Equipe', path: '/equipe', icon: Users }] : []),
    { label: 'Configurações', path: '/configuracoes', icon: Settings },
  ]

  const getInitials = (name?: string) => {
    if (!name) return 'CC'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return (
    <div className="flex h-screen w-full bg-[#F7F7F8] overflow-hidden font-sans text-[#111827]">
      {/* SIDEBAR (Desktop 260px) */}
      <aside className="w-[260px] flex-shrink-0 flex flex-col justify-between border-r border-[#E5E7EB] bg-white z-20">
        {/* Top: Brand Header */}
        <div>
          <div className="h-16 flex items-center px-6 border-b border-[#E5E7EB]/60 gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white shadow-sm shadow-indigo-200">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-tight text-[#111827]">
                Copiloto Comercial
              </span>
              <span className="text-[10px] text-[#6B7280] font-medium tracking-wide uppercase">
                Inteligência IA
              </span>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                      : 'text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]',
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-[#4F46E5]' : 'text-[#6B7280]')} />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* Bottom: Profile & WhatsApp connection card */}
        <div className="p-3 border-t border-[#E5E7EB]/80 bg-white">
          <div
            onClick={() => navigate('/configuracoes?tab=conexoes')}
            role="button"
            tabIndex={0}
            className="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F9FAFB] cursor-pointer transition border border-transparent hover:border-[#E5E7EB]"
          >
            <div className="w-9 h-9 rounded-full bg-[#EEF2FF] text-[#4F46E5] font-semibold text-xs flex items-center justify-center border border-indigo-100 flex-shrink-0">
              {getInitials(user?.name || user?.email)}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-[#111827] truncate">
                {user?.name || user?.email || 'Arthur Ademicon'}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full inline-block',
                    isWaConnected ? 'bg-[#10B981]' : 'bg-[#EF4444]',
                  )}
                />
                <span className="text-[11px] text-[#6B7280]">
                  {isWaConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:translate-x-0.5 transition-transform" />
          </div>

          <div className="mt-2 flex items-center justify-between px-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] text-[#9CA3AF] font-medium capitalize">
              {profile?.role || 'consultor'}
            </span>
            <button
              onClick={logout}
              title="Sair da conta"
              className="text-[#9CA3AF] hover:text-[#EF4444] transition-colors p-1 rounded-md"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-[#E5E7EB] px-6 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#6B7280]">Modo:</span>
            <Badge
              variant="outline"
              className={cn(
                'text-[11px] font-medium py-0.5 px-2 rounded-full border',
                profile?.autonomy_mode === 'autonomous_followup'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : profile?.autonomy_mode === 'copilot_automations'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200',
              )}
            >
              <ShieldCheck className="w-3 h-3 mr-1 inline" />
              {profile?.autonomy_mode === 'autonomous_followup'
                ? 'Follow-up Autônomo'
                : profile?.autonomy_mode === 'copilot_automations'
                  ? 'Copiloto + Automações'
                  : 'Copiloto (Apenas Recomendações)'}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* WhatsApp Quick Status pill */}
            <div
              onClick={() => navigate('/configuracoes?tab=conexoes')}
              role="button"
              tabIndex={0}
              className="cursor-pointer flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-slate-100 transition"
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  isWaConnected ? 'bg-[#10B981]' : 'bg-[#EF4444]',
                )}
              />
              <span className="text-[#374151]">
                {isWaConnected
                  ? whatsappInstance?.provider === 'evolution_api'
                    ? 'WhatsApp Evolution Conectado'
                    : 'WhatsApp Demo Conectado'
                  : 'WhatsApp Desconectado'}
              </span>
            </div>

            {/* Notification Bell with Dropdown */}
            <DropdownMenu open={alertsOpen} onOpenChange={setAlertsOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-full">
                  <Bell className="w-4 h-4 text-[#4B5563]" />
                  {criticalAndActionCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#EF4444] text-[10px] font-bold text-white flex items-center justify-center">
                      {criticalAndActionCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-2 shadow-lg border-[#E5E7EB]">
                <DropdownMenuLabel className="text-xs font-semibold text-[#111827] flex items-center justify-between">
                  <span>Central de Alertas</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {alerts.length} ativos
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="space-y-1 py-1 max-h-72 overflow-y-auto">
                  {alerts.map((alt) => (
                    <DropdownMenuItem
                      key={alt.id}
                      onClick={alt.action}
                      className="cursor-pointer flex items-start gap-2.5 p-2 rounded-lg text-xs"
                    >
                      {alt.priority === 'CRITICA' ? (
                        <AlertTriangle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
                      ) : alt.priority === 'ACAO_NECESSARIA' ? (
                        <Clock className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[#111827]">{alt.title}</div>
                        <div className="text-[11px] text-[#6B7280] leading-snug">
                          {alt.description}
                        </div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-[#9CA3AF] mt-1" />
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 overflow-y-auto bg-[#F7F7F8]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
