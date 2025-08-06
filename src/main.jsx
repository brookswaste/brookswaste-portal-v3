import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DriverDashboard from './pages/DriverDashboard.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import PortalooManager from './pages/PortalooManager.jsx'
import Bookings from './pages/Bookings.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx' // 🔥 add this
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Login stays outside the layout */}
        <Route path="/" element={<LoginPage />} />

        {/* All pages wrapped in Layout */}
        <Route element={<Layout />}>
          <Route
            path="/driver-dashboard"
            element={
              <ProtectedRoute adminOnly={false}>
                <DriverDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute adminOnly={true}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/portaloo-manager"
            element={
              <ProtectedRoute adminOnly={true}>
                <PortalooManager />
              </ProtectedRoute>
            }
          />

          <Route
            path="/bookings"
            element={
              <ProtectedRoute adminOnly={true}>
                <Bookings />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
