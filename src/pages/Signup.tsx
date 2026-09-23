import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles, Mail, Lock, User, Loader2, ArrowRight } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== passwordConfirm) {
      toast({
        title: 'Senhas não coincidem',
        description: 'Por favor, confirme a mesma senha digitada.',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      await pb.collection('users').create({
        email,
        password,
        passwordConfirm,
        name,
      })

      // Send verification email
      try {
        await pb.collection('users').requestVerification(email)
      } catch {
        /* intentionally ignored */
      }

      // Login
      await pb.collection('users').authWithPassword(email, password)

      // Initialize profile
      try {
        await pb.collection('user_profiles').create({
          user: pb.authStore.record?.id,
          role: 'consultor',
          autonomy_mode: 'copilot',
          business_hours: [
            { day: 'Segunda-feira', start: '08:00', end: '18:00', enabled: true },
            { day: 'Terça-feira', start: '08:00', end: '18:00', enabled: true },
            { day: 'Quarta-feira', start: '08:00', end: '18:00', enabled: true },
            { day: 'Quinta-feira', start: '08:00', end: '18:00', enabled: true },
            { day: 'Sexta-feira', start: '08:00', end: '18:00', enabled: true },
            { day: 'Sábado', start: '09:00', end: '13:00', enabled: false },
            { day: 'Domingo', start: '00:00', end: '00:00', enabled: false },
          ],
          whatsapp_connected: false,
          google_calendar_connected: false,
        })
      } catch {
        /* intentionally ignored */
      }

      toast({
        title: 'Conta criada com sucesso!',
        description: 'Vamos configurar seu WhatsApp e rotina comercial.',
      })

      navigate('/onboarding')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar conta'
      toast({
        title: 'Erro no cadastro',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      <div className="absolute w-[500px] h-[500px] bg-gradient-to-tr from-indigo-200/40 via-purple-100/30 to-blue-200/30 rounded-full blur-3xl -top-20 -left-20 pointer-events-none" />

      <div className="flex items-center gap-3 mb-8 z-10">
        <div className="w-10 h-10 rounded-2xl bg-[#4F46E5] flex items-center justify-center text-white shadow-md shadow-indigo-200">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111827]">Copiloto Comercial IA</h1>
          <p className="text-xs text-[#6B7280]">Cadastro de novo consultor comercial</p>
        </div>
      </div>

      <div className="w-full max-w-[440px] bg-white rounded-3xl p-8 border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.04)] z-10">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[#111827]">Criar sua conta</h2>
          <p className="text-xs text-[#6B7280] mt-1">
            Preencha seus dados para iniciar a jornada com o Copiloto IA.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <Label htmlFor="name" className="text-xs font-medium text-[#374151]">
              Nome completo
            </Label>
            <div className="relative">
              <User className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-3" />
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Arthur Silva"
                className="pl-9 h-10 rounded-xl text-sm border-[#E5E7EB]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs font-medium text-[#374151]">
              E-mail corporativo
            </Label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-3" />
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="consultor@ademicon.com.br"
                className="pl-9 h-10 rounded-xl text-sm border-[#E5E7EB]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pass" className="text-xs font-medium text-[#374151]">
              Senha (mínimo 8 caracteres)
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-3" />
              <Input
                id="pass"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9 h-10 rounded-xl text-sm border-[#E5E7EB]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="conf" className="text-xs font-medium text-[#374151]">
              Confirmar senha
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-3" />
              <Input
                id="conf"
                type="password"
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                className="pl-9 h-10 rounded-xl text-sm border-[#E5E7EB]"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-sm transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  Prosseguir para Onboarding
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-[#E5E7EB] text-center">
          <p className="text-xs text-[#6B7280]">
            Já possui cadastro?{' '}
            <Link to="/login" className="text-[#4F46E5] font-semibold hover:underline">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
