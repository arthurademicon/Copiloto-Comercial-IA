import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await pb.collection('users').requestPasswordReset(email)
      setSubmitted(true)
      toast({
        title: 'Link enviado com sucesso!',
        description: 'Verifique sua caixa de entrada para redefinir sua senha.',
      })
    } catch {
      // Don't leak user existence
      setSubmitted(true)
      toast({
        title: 'Link enviado!',
        description: 'Se o e-mail existir no sistema, você receberá as instruções em instantes.',
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
          <p className="text-xs text-[#6B7280]">Recuperação de acesso</p>
        </div>
      </div>

      <div className="w-full max-w-[440px] bg-white rounded-3xl p-8 border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.04)] z-10">
        {!submitted ? (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[#111827]">Redefinir senha</h2>
              <p className="text-xs text-[#6B7280] mt-1">
                Informe o seu e-mail de acesso para enviarmos o link seguro de recuperação.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-[#374151]">
                  E-mail cadastrado
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

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-sm transition-all"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar link de redefinição'
                  )}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-3" />
            <h3 className="text-base font-semibold text-[#111827]">Instruções enviadas!</h3>
            <p className="text-xs text-[#6B7280] mt-2 leading-relaxed">
              Enviamos um link de redefinição para <strong>{email}</strong>. Siga as instruções para
              criar uma nova senha.
            </p>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-[#E5E7EB] text-center">
          <Link
            to="/login"
            className="inline-flex items-center text-xs text-[#4F46E5] font-medium hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
