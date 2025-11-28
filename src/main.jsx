import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DriverDashboard from './pages/DriverDashboard.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import Bookings from './pages/Bookings.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Todo from './pages/Todo.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>

        {/* Login */}
        <Route path="/" element={<LoginPage />} />

        {/* Driver Dashboard */}
        <Route
          path="/driver-dashboard"
          element={
            <ProtectedRoute adminOnly={false}>
              <DriverDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin Dashboard */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute adminOnly={true}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Bookings */}
        <Route
          path="/bookings"
          element={
            <ProtectedRoute adminOnly={true}>
              <Bookings />
            </ProtectedRoute>
          }
        />

        {/* To-Do Page */}
        <Route
          path="/todo"
          element={
            <ProtectedRoute adminOnly={true}>
              <Todo />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<App />} />

      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
