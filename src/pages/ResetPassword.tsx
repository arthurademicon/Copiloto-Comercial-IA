import { type FormEvent, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Sparkles, Lock, Loader2, CheckCircle2 } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast({
        title: 'Token inválido ou expirado',
        description: 'Solicite um novo link de redefinição de senha.',
        variant: 'destructive',
      })
      return
    }

    if (password !== passwordConfirm) {
      toast({
        title: 'Senhas não coincidem',
        description: 'As duas senhas digitadas devem ser idênticas.',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
      toast({
        title: 'Senha redefinida com sucesso!',
        description: 'Faça login com a nova senha criada.',
      })
      navigate('/login')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao redefinir senha'
      toast({
        title: 'Erro na redefinição',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      <div className="flex items-center gap-3 mb-8 z-10">
        <div className="w-10 h-10 rounded-2xl bg-[#4F46E5] flex items-center justify-center text-white shadow-md">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111827]">Copiloto Comercial IA</h1>
          <p className="text-xs text-[#6B7280]">Nova senha de acesso</p>
        </div>
      </div>

      <div className="w-full max-w-[440px] bg-white rounded-3xl p-8 border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.04)] z-10">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[#111827]">Criar nova senha</h2>
          <p className="text-xs text-[#6B7280] mt-1">
            Defina uma senha forte com pelo menos 8 caracteres.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pass" className="text-xs font-medium text-[#374151]">
              Nova senha
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

          <div className="space-y-1.5">
            <Label htmlFor="conf" className="text-xs font-medium text-[#374151]">
              Confirmar nova senha
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
                  Atualizando...
                </>
              ) : (
                'Definir nova senha'
              )}
            </Button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-[#E5E7EB] text-center">
          <Link to="/login" className="text-xs text-[#4F46E5] font-medium hover:underline">
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
