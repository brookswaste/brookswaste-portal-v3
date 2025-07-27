import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AdminDashboard() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="bg-wrap bg-gradient-to-br from-white to-slate-100 min-h-screen px-6 py-10 relative">
      {/* Log Out button (top-right corner) */}
      <button
        onClick={handleLogout}
        className="btn-bubbly absolute top-4 right-6 text-sm px-4 py-2"
      >
        Log Out
      </button>

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Breadcrumbs */}
        <div className="text-sm text-gray-500">
          <button onClick={() => navigate('/')} className="hover:underline">
            ← Back to Login
          </button>
        </div>

        {/* Header */}
        <div className="card-glass">
          <h1 className="text-2xl font-bold text-black">Admin Dashboard</h1>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <button
            onClick={() => navigate('/bookings')}
            className="btn-dashboard w-60 py-4 px-6 text-lg"
          >
            Bookings
          </button>
        </div>
      </div>
    </div>
  )
}
