import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setAllowed(false)
        setLoading(false)
        return
      }

      if (adminOnly) {
        const { data: admin } = await supabase
          .from('admin_users')
          .select('auth_id')
          .eq('auth_id', user.id)
          .single()

        setAllowed(!!admin)
      } else {
        const { data: driver } = await supabase
          .from('drivers')
          .select('id')
          .eq('id', user.id)
          .single()

        setAllowed(!!driver)
      }

      setLoading(false)
    }

    checkAccess()
  }, [adminOnly])

  if (loading) return <div className="text-center pt-10">Checking access...</div>

  if (!allowed) return <Navigate to="/" replace />

  return children
}
