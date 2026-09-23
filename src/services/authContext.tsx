import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { RecordModel } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import type { UserProfile, WhatsappInstance } from '@/types'
import { startDemoSimulator, stopDemoSimulator } from '@/services/messagingAdapter'

interface AuthContextType {
  user: RecordModel | null
  profile: UserProfile | null
  whatsappInstance: WhatsappInstance | null
  isLoading: boolean
  refreshProfile: () => Promise<void>
  refreshWhatsapp: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RecordModel | null>(pb.authStore.record)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [whatsappInstance, setWhatsappInstance] = useState<WhatsappInstance | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfileAndWa = async (userId: string) => {
    try {
      // Fetch or auto-create profile
      try {
        const prof = await pb
          .collection('user_profiles')
          .getFirstListItem<UserProfile>(`user="${userId}"`)
        setProfile(prof)
      } catch {
        // Auto initialize default profile if missing
        const newProf = await pb.collection('user_profiles').create<UserProfile>({
          user: userId,
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
        setProfile(newProf)
      }

      // Fetch or set WA instance
      try {
        const wa = await pb
          .collection('whatsapp_instances')
          .getFirstListItem<WhatsappInstance>(`user="${userId}"`)
        setWhatsappInstance(wa)
      } catch {
        setWhatsappInstance(null)
      }
    } catch (e) {
      console.error('Error fetching profile or whatsapp:', e)
    }
  }

  useEffect(() => {
    const unsub = pb.authStore.onChange((_token, model) => {
      setUser(model)
      if (model) {
        fetchProfileAndWa(model.id).finally(() => setIsLoading(false))
        startDemoSimulator()
      } else {
        setProfile(null)
        setWhatsappInstance(null)
        setIsLoading(false)
        stopDemoSimulator()
      }
    })

    if (pb.authStore.isValid && pb.authStore.record) {
      fetchProfileAndWa(pb.authStore.record.id).finally(() => {
        setIsLoading(false)
        startDemoSimulator()
      })
    } else {
      setIsLoading(false)
    }

    return () => {
      unsub()
      stopDemoSimulator()
    }
  }, [])

  const refreshProfile = async () => {
    if (user) {
      await fetchProfileAndWa(user.id)
    }
  }

  const refreshWhatsapp = async () => {
    if (user) {
      try {
        const wa = await pb
          .collection('whatsapp_instances')
          .getFirstListItem<WhatsappInstance>(`user="${user.id}"`)
        setWhatsappInstance(wa)
      } catch {
        setWhatsappInstance(null)
      }
    }
  }

  const logout = () => {
    pb.authStore.clear()
    stopDemoSimulator()
    setUser(null)
    setProfile(null)
    setWhatsappInstance(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        whatsappInstance,
        isLoading,
        refreshProfile,
        refreshWhatsapp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
