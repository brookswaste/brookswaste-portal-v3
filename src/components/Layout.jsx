import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div>
      {/* Sticky Header */}
      <header className="fixed top-0 left-0 w-full bg-white shadow z-50 px-6 py-4 flex items-center">
        <img src="/images/brooks-logo.png" alt="Brooks Waste Logo" className="h-10" />
      </header>

      {/* Main Content Area */}
      <main className="pt-20 px-4">
        <Outlet />
      </main>
    </div>
  )
}
