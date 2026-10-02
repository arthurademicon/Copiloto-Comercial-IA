/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from './services/authContext'
import Index from './pages/Index'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'
import Conversas from './pages/Conversas'
import Pipeline from './pages/Pipeline'
import Followups from './pages/Followups'
import Agenda from './pages/Agenda'
import Copiloto from './pages/Copiloto'
import Conhecimento from './pages/Conhecimento'
import Relatorios from './pages/Relatorios'
import Disparos from './pages/Disparos'
import Prospeccao from './pages/Prospeccao'
import Equipe from './pages/Equipe'
import Configuracoes from './pages/Configuracoes'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import Onboarding from './pages/Onboarding'

// ONLY IMPORT AND RENDER WORKING PAGES, NEVER ADD PLACEHOLDER COMPONENTS OR PAGES IN THIS FILE
// AVOID REMOVING ANY CONTEXT PROVIDERS FROM THIS FILE (e.g. TooltipProvider, Toaster, Sonner)

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Auth & Onboarding */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Protected App Routes inside Layout */}
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/conversas" element={<Conversas />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/followups" element={<Followups />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/copiloto" element={<Copiloto />} />
            <Route path="/conhecimento" element={<Conhecimento />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/disparos" element={<Disparos />} />
            <Route path="/prospeccao" element={<Prospeccao />} />
            <Route path="/equipe" element={<Equipe />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
