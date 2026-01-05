import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Invalid login credentials')
      return
    }

    const user = data.user
    const { data: adminMatch } = await supabase
      .from('admin_users')
      .select('auth_id')
      .eq('auth_id', user.id)
      .single()

    if (adminMatch) {
      navigate('/bookings')
    } else {
      navigate('/driver-dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md p-8 space-y-6 bg-white border border-gray-200 shadow-2xl rounded-xl"
        style={{
          boxShadow: '0 0 25px rgba(255, 20, 147, 0.5)',
          border: '1px solid #ccc',
        }}
      >
        <h1 className="text-3xl font-extrabold text-center text-black mb-4">
          Brooks Waste Portal
        </h1>
        <h2 className="text-xl text-center text-gray-700 font-semibold">
          Sign In
        </h2>
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 rounded bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-400"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 rounded bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-400"
        />
        <button
          type="submit"
          className="w-full p-3 rounded-full font-semibold transition transform hover:scale-105"
          style={{
            background: 'linear-gradient(to right, #fff, #ffe6f0)',
            boxShadow: '0 0 12px #ff69b4, inset 0 0 6px #ff69b4',
            color: '#ff1493',
            border: '2px solid #ff69b4',
            textShadow: '0 0 1px white',
          }}
        >
          Sign In
        </button>
      </form>
    </div>
  )
}
