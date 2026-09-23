import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }

    const confirm = async () => {
      try {
        await pb.collection('users').confirmVerification(token)
        setStatus('success')
      } catch {
        setStatus('error')
      }
    }
    confirm()
  }, [token])

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      <div className="flex items-center gap-3 mb-8 z-10">
        <div className="w-10 h-10 rounded-2xl bg-[#4F46E5] flex items-center justify-center text-white shadow-md">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111827]">Copiloto Comercial IA</h1>
          <p className="text-xs text-[#6B7280]">Confirmação de e-mail</p>
        </div>
      </div>

      <div className="w-full max-w-[440px] bg-white rounded-3xl p-8 border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.04)] text-center z-10">
        {status === 'verifying' && (
          <div className="py-6">
            <Loader2 className="w-10 h-10 text-[#4F46E5] animate-spin mx-auto mb-4" />
            <h2 className="text-base font-semibold text-[#111827]">Validando seu e-mail...</h2>
            <p className="text-xs text-[#6B7280] mt-1">Por favor aguarde um instante.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6">
            <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-[#111827]">E-mail verificado com sucesso!</h2>
            <p className="text-xs text-[#6B7280] mt-2 mb-6">
              Sua conta foi autenticada. Agora você pode prosseguir para configurar seu WhatsApp e
              rotina comercial.
            </p>
            <Button
              onClick={() => navigate('/onboarding')}
              className="w-full h-10 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-sm"
            >
              Ir para o painel de configuração
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="py-6">
            <AlertCircle className="w-12 h-12 text-[#EF4444] mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-[#111827]">Link inválido ou expirado</h2>
            <p className="text-xs text-[#6B7280] mt-2 mb-6">
              O token de verificação já foi utilizado ou perdeu a validade.
            </p>
            <Link to="/login">
              <Button variant="outline" className="w-full h-10 rounded-xl text-sm">
                Voltar para o login
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
