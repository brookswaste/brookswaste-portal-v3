import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { NewBookingModal } from '../components/NewBooking'

// Utils
const todayISO = () => new Date().toISOString().split('T')[0]

export default function AdminDashboard() {
  const navigate = useNavigate()

  // Layout / UI
  const [showNewBooking, setShowNewBooking] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerJob, setDrawerJob] = useState(null)

  // Data
  const [drivers, setDrivers] = useState([])
  const [jobsToday, setJobsToday] = useState([])
  const [unpaidJobs, setUnpaidJobs] = useState([])
  const [invoiceJobs, setInvoiceJobs] = useState([])

  // KPI
  const kpi = useMemo(() => ({
    todays: jobsToday.length,
    needInvoicing: invoiceJobs.length,
    unpaid: unpaidJobs.length,
  }), [jobsToday, invoiceJobs, unpaidJobs])

  // Helpers
  const driverName = (id) => drivers.find(d => d.id === id)?.name || '—'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const openDrawer = (job) => {
    setDrawerJob({
      ...job,
      // local fields for editing
      _paid: !!job.paid,
      _invoice_required: !!job.invoice_required,
      _invoice_sent: !!job.invoice_sent,
    })
    setDrawerOpen(true)
  }

  const saveDrawer = async () => {
    if (!drawerJob) return
    const payload = {
      paid: !!drawerJob._paid,
      invoice_required: !!drawerJob._invoice_required,
      invoice_sent: !!drawerJob._invoice_sent,
    }
    await supabase.from('jobs').update(payload).eq('id', drawerJob.id)
    setDrawerOpen(false)
    setDrawerJob(null)
    // refresh
    await Promise.all([fetchDrivers(), fetchBlocks(selectedDate)])
  }

  // Data fetch
  useEffect(() => {
    fetchDrivers()
  }, [])

  useEffect(() => {
    fetchBlocks(selectedDate)
  }, [selectedDate])

  const fetchDrivers = async () => {
    const { data } = await supabase.from('drivers').select('id,name').order('name')
    setDrivers(data || [])
  }

  const fetchBlocks = async (dateStr) => {
    // Today’s jobs
    const { data: today } = await supabase
      .from('jobs')
      .select('*')
      .eq('date_of_service', dateStr)
      .order('driver_id', { ascending: true })
      .order('job_order', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })

    setJobsToday(today || [])

    // Unpaid jobs (any date)
    const { data: unpaid } = await supabase
      .from('jobs')
      .select('*')
      .eq('paid', false)
      .order('date_of_service', { ascending: true, nullsFirst: true })
      .limit(20)

    setUnpaidJobs(unpaid || [])

    // Jobs needing invoicing = invoice_required = true AND invoice_sent = false
    const { data: needInv } = await supabase
      .from('jobs')
      .select('*')
      .eq('invoice_required', true)
      .eq('invoice_sent', false)
      .order('date_of_service', { ascending: true, nullsFirst: true })
      .limit(20)

    setInvoiceJobs(needInv || [])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-slate-100 pt-16 relative">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b z-50">
        <div className="mx-auto max-w-screen-lg px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/brooks-logo.png" alt="Brooks Waste" className="h-8" />
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-sm font-semibold text-black">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowNewBooking(true)}
            >
              Add New Booking
            </button>

            <button
              className="btn btn-neutral btn-sm"
              onClick={() => navigate('/todo')}
            >
              Open To-Do
            </button>

            <button
              className="btn btn-neutral btn-sm"
              onClick={handleLogout}
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-lg px-4 py-6 grid grid-cols-[220px,1fr] gap-6">
        {/* Sidebar (slim) */}
        <aside className="sticky top-16 self-start">
          <nav className="rounded-xl border bg-white shadow-sm">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Navigation</div>
            <ul className="text-sm">
              <SideItem label="Dashboard" active onClick={() => navigate('/admin-dashboard')} />
              <SideItem label="Bookings" onClick={() => navigate('/bookings')} />
              <SideItem label="To-Dos" onClick={() => navigate('/todo')} />
            </ul>
          </nav>

          {/* Date filter */}
          <div className="mt-4 rounded-xl border bg-white shadow-sm p-3">
            <label className="text-xs text-gray-600">Date</label>
            <input
              type="date"
              className="mt-1 w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-pink-400"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </aside>

        {/* Main content */}
        <section className="space-y-6">
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-4">
            <KPICard label="Today’s Jobs" value={kpi.todays} />
            <KPICard label="Jobs Needing Invoicing" value={kpi.needInvoicing} />
            <KPICard label="Unpaid Jobs" value={kpi.unpaid} />
          </div>

          {/* Today’s Jobs */}
          <div className="rounded-2xl bg-white shadow-sm border">
            <HeaderBar title="Today’s Jobs" />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-pink-50 text-left text-xs font-semibold text-black uppercase tracking-wider">
                    <th className="px-3 py-2 border">ID</th>
                    <th className="px-3 py-2 border">Type</th>
                    <th className="px-3 py-2 border">Address 1</th>
                    <th className="px-3 py-2 border">Postcode</th>
                    <th className="px-3 py-2 border">Driver</th>
                    <th className="px-3 py-2 border">Order</th>
                    <th className="px-3 py-2 border">Complete</th>
                    <th className="px-3 py-2 border">Paid</th>
                    <th className="px-3 py-2 border">Invoice</th>
                    <th className="px-3 py-2 border">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {jobsToday.length === 0 ? (
                    <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-500">No jobs for this date.</td></tr>
                  ) : jobsToday.map(job => (
                    <tr key={job.id} className="hover:bg-pink-50">
                      <td className="px-3 py-2 border">{job.id}</td>
                      <td className="px-3 py-2 border">{job.job_type || '—'}</td>
                      <td className="px-3 py-2 border">{job.address_line_1 || '—'}</td>
                      <td className="px-3 py-2 border">{job.post_code || '—'}</td>
                      <td className="px-3 py-2 border">{driverName(job.driver_id)}</td>
                      <td className="px-3 py-2 border">{job.job_order ?? '—'}</td>
                      <td className="px-3 py-2 border">{boolChip(job.job_complete)}</td>
                      <td className="px-3 py-2 border">{boolChip(job.paid)}</td>
                      <td className="px-3 py-2 border">
                        {job.invoice_required ? (
                          <span className={`inline-block px-2 py-0.5 text-xs rounded border ${job.invoice_sent ? 'border-green-300' : 'border-amber-300'}`}>
                            {job.invoice_sent ? 'Sent' : 'Required'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 border">
                        <button
                          className="btn btn-neutral btn-sm"
                          onClick={() => openDrawer(job)}
                        >
                          Quick Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Two-up mini tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MiniTable
              title="Unpaid Jobs"
              rows={unpaidJobs}
              driverName={driverName}
              onQuickEdit={openDrawer}
              empty="No unpaid jobs."
            />
            <MiniTable
              title="Jobs Needing Invoicing"
              rows={invoiceJobs}
              driverName={driverName}
              onQuickEdit={openDrawer}
              empty="No jobs need invoicing."
            />
          </div>
        </section>
      </div>

      {/* Side Drawer for inline edits */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[360px] bg-white shadow-2xl border-l p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Quick Edit</h3>
              <button className="btn btn-neutral btn-sm" onClick={() => setDrawerOpen(false)}>Close</button>
            </div>
            {drawerJob && (
              <div className="space-y-3 text-sm">
                <div className="text-xs text-gray-500">Job #{drawerJob.id}</div>
                <div><span className="text-gray-600">Type:</span> {drawerJob.job_type || '—'}</div>
                <div><span className="text-gray-600">Address:</span> {drawerJob.address_line_1 || '—'}, {drawerJob.post_code || '—'}</div>
                <div className="border-t pt-3">
                  <label className="block text-xs text-gray-600">Paid</label>
                  <select
                    className="w-full p-2 border rounded"
                    value={drawerJob._paid ? 'Yes' : 'No'}
                    onChange={(e) => setDrawerJob(d => ({ ...d, _paid: e.target.value === 'Yes' }))}
                  >
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600">Invoice Required</label>
                  <select
                    className="w-full p-2 border rounded"
                    value={drawerJob._invoice_required ? 'Yes' : 'No'}
                    onChange={(e) => setDrawerJob(d => ({ ...d, _invoice_required: e.target.value === 'Yes' }))}
                  >
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600">Invoice Sent</label>
                  <select
                    className="w-full p-2 border rounded"
                    value={drawerJob._invoice_sent ? 'Yes' : 'No'}
                    onChange={(e) => setDrawerJob(d => ({ ...d, _invoice_sent: e.target.value === 'Yes' }))}
                  >
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button className="btn btn-neutral btn-sm" onClick={() => setDrawerOpen(false)}>Cancel</button>
                  <button className="btn btn-primary btn-md" onClick={saveDrawer}>Save</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add New Booking modal */}
      {showNewBooking && (
        <NewBookingModal
          onClose={() => setShowNewBooking(false)}
          onSave={() => {
            setShowNewBooking(false)
            fetchBlocks(selectedDate)
          }}
        />
      )}
    </div>
  )
}

/* ---------- Small presentational helpers ---------- */

function SideItem({ label, active = false, onClick }) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2 border-t first:border-t-0 hover:bg-pink-50 ${
          active ? 'bg-pink-50 font-semibold text-pink-700' : ''
        }`}
      >
        {label}
      </button>
    </li>
  )
}

function KPICard({ label, value }) {
  return (
    <div className="rounded-xl border bg-white shadow-sm p-4">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-black">{value}</div>
      <div className="mt-2 h-1 w-full bg-pink-100 rounded">
        <div className="h-1 bg-pink-400 rounded" style={{ width: '100%' }} />
      </div>
    </div>
  )
}

function HeaderBar({ title }) {
  return (
    <div className="px-4 py-3 border-b flex items-center justify-between">
      <h2 className="text-sm font-semibold text-black">{title}</h2>
    </div>
  )
}

function boolChip(val) {
  if (val === true) return <span className="inline-block px-2 py-0.5 text-xs rounded border border-green-300">Yes</span>
  if (val === false) return <span className="inline-block px-2 py-0.5 text-xs rounded border border-red-300">No</span>
  return <span className="inline-block px-2 py-0.5 text-xs rounded border border-gray-300">—</span>
}

function MiniTable({ title, rows, driverName, onQuickEdit, empty }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border">
      <HeaderBar title={title} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-pink-50 text-left text-xs font-semibold text-black uppercase tracking-wider">
              <th className="px-3 py-2 border">ID</th>
              <th className="px-3 py-2 border">Type</th>
              <th className="px-3 py-2 border">Date</th>
              <th className="px-3 py-2 border">Driver</th>
              <th className="px-3 py-2 border">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">{empty}</td></tr>
            ) : rows.map(job => (
              <tr key={job.id} className="hover:bg-pink-50">
                <td className="px-3 py-2 border">{job.id}</td>
                <td className="px-3 py-2 border">{job.job_type || '—'}</td>
                <td className="px-3 py-2 border">{job.date_of_service || '—'}</td>
                <td className="px-3 py-2 border">{driverName(job.driver_id)}</td>
                <td className="px-3 py-2 border">
                  <button className="btn btn-neutral btn-sm" onClick={() => onQuickEdit(job)}>Quick Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
