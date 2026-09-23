import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles, Mail, Lock, Loader2, ArrowRight } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'

export default function Login() {
  const [email, setEmail] = useState('arth.ademicon@gmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const authData = await pb.collection('users').authWithPassword(email, password)
      toast({
        title: 'Bem-vindo de volta!',
        description: `Conectado como ${authData.record.name || authData.record.email}`,
      })

      // Check onboarding completion
      try {
        const prof = await pb
          .collection('user_profiles')
          .getFirstListItem(`user="${authData.record.id}"`)
        if (prof.whatsapp_connected) {
          navigate('/')
        } else {
          navigate('/onboarding')
        }
      } catch {
        navigate('/')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Credenciais inválidas'
      toast({
        title: 'Erro ao entrar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Decorative background blob */}
      <div className="absolute w-[500px] h-[500px] bg-gradient-to-tr from-indigo-200/40 via-purple-100/30 to-blue-200/30 rounded-full blur-3xl -top-20 -left-20 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] bg-gradient-to-br from-indigo-100/50 to-pink-100/30 rounded-full blur-3xl -bottom-20 -right-20 pointer-events-none" />

      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-8 z-10">
        <div className="w-10 h-10 rounded-2xl bg-[#4F46E5] flex items-center justify-center text-white shadow-md shadow-indigo-200">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111827]">Copiloto Comercial IA</h1>
          <p className="text-xs text-[#6B7280]">Inteligência que atua invisível no seu WhatsApp</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-[440px] bg-white rounded-3xl p-8 border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.04)] z-10">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[#111827]">Acesse sua conta</h2>
          <p className="text-xs text-[#6B7280] mt-1">
            Entre com suas credenciais ou utilize a conta padrão pré-carregada.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
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
                className="pl-9 h-10 rounded-xl text-sm border-[#E5E7EB] focus-visible:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pass" className="text-xs font-medium text-[#374151]">
                Senha
              </Label>
              <Link to="/forgot-password" className="text-[11px] text-[#4F46E5] hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-3" />
              <Input
                id="pass"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9 h-10 rounded-xl text-sm border-[#E5E7EB] focus-visible:ring-indigo-500"
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
                  Acessando...
                </>
              ) : (
                <>
                  Entrar no Copiloto
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-[#E5E7EB] text-center">
          <p className="text-xs text-[#6B7280]">
            Ainda não tem acesso?{' '}
            <Link to="/signup" className="text-[#4F46E5] font-semibold hover:underline">
              Criar conta de consultor
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
