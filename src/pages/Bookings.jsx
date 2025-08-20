import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { NewBookingModal } from '../components/NewBooking'
import EditModal from '../components/EditModal'
import {
  ViewEditArchivedJobModal,
  ViewWTNPDFModal,
} from '../components/BookingsModals'
import NewWTN from '../components/NewWTN'
import EditWTN from '../components/EditWTN'

export default function Bookings() {
  const [jobs, setJobs] = useState([])
  const [archivedJobs, setArchivedJobs] = useState([])
  const [drivers, setDrivers] = useState([])
  const [wtns, setWTNs] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [archivedSearch, setArchivedSearch] = useState('')
  const [archivedPaidFilter, setArchivedPaidFilter] = useState('All')
  const [archivedPaymentTypeFilter, setArchivedPaymentTypeFilter] = useState('All')
  const [archivedDriverFilter, setArchivedDriverFilter] = useState('')
  const [archivedDateFilter, setArchivedDateFilter] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [activeModal, setActiveModal] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [selectedWTN, setSelectedWTN] = useState(null)
  const [wtnPDFUrl, setWTNPDFUrl] = useState(null)
  const [paidFilter, setPaidFilter] = useState('All')
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('All')
  const [selectedDriverFilter, setSelectedDriverFilter] = useState('')
  const [selectedDateFilter, setSelectedDateFilter] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchJobs()
    fetchArchivedJobs()
    fetchDrivers()
    fetchWTNs()
  }, [])

  const fetchJobs = async () => {
    const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('id', { ascending: true })
    if (!error) setJobs(data)
  }

  const fetchArchivedJobs = async () => {
    const { data, error } = await supabase.from('archived_jobs').select('*')
    if (!error) setArchivedJobs(data)
  }

  const fetchDrivers = async () => {
    const { data, error } = await supabase.from('drivers').select('id, name')
    if (!error) setDrivers(data)
  }

  const fetchWTNs = async () => {
    const { data, error } = await supabase.from('waste_transfer_notes').select('id, job_id')
    if (!error) {
      const map = {}
      data.forEach(wtn => {
        map[wtn.job_id] = wtn.id
      })
      setWTNs(map)
    }
  }

  const getDriverName = (id) => {
    const driver = drivers.find((d) => d.id === id)
    return driver ? driver.name : '-'
  }

  const updateAssignedDriver = async (jobId, driverId) => {
    const { error } = await supabase
      .from('jobs')
      .update({ driver_id: driverId })
      .eq('id', jobId)

    if (!error) fetchJobs()
  }

  const updateJobField = async (jobId, field, value) => {
    const { error } = await supabase
      .from('jobs')
      .update({ [field]: value })
      .eq('id', jobId)

    if (!error) fetchJobs()
  }


  const updateJobOrder = async (jobId, order) => {
    const { error } = await supabase
      .from('jobs')
      .update({ job_order: order })
      .eq('id', jobId)

    if (!error) fetchJobs()
  }

  const handleNewWTN = async (job) => {
    const { data: existing, error } = await supabase
      .from('waste_transfer_notes')
      .select('*')
      .eq('job_id', job.id)
      .single()

    if (existing) {
      setSelectedWTN(existing)
      setSelectedJob(job)
      setActiveModal('editWtn')
    } else {
      setSelectedJob(job)
      setActiveModal('createWtn')
    }
  }

  const handleArchive = async (job) => {
    const { id, ...jobData } = job

    // Force-include job_order in case it's undefined or missing
    const fullJobData = {
      ...jobData,
      job_order: job.job_order || null // optional fallback
    }

    const { error } = await supabase.from('archived_jobs').insert([fullJobData])
    if (!error) {
      await supabase.from('jobs').delete().eq('id', id)
      fetchJobs()
      fetchArchivedJobs()
    } else {
      console.error('Archive error:', error)
    }
  }

  const handleEdit = (job) => {
    setSelectedJob(job)
    setActiveModal('edit')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const filteredJobs = jobs
    .filter((job) =>
      Object.values(job).some((val) =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
    .filter((job) => {
      if (paidFilter === 'All') return true
      return paidFilter === 'Paid' ? job.paid === true : job.paid === false
    })
    .filter((job) => {
      if (paymentTypeFilter === 'All') return true
      return job.payment_type === paymentTypeFilter
    })
    .filter((job) => {
      if (!selectedDriverFilter) return true
      return job.driver_id === selectedDriverFilter
    })
    .filter((job) => {
      if (!selectedDateFilter) return true
      return job.date_of_service === selectedDateFilter
    })
    .sort((a, b) => {
      const driverA = getDriverName(a.driver_id).toLowerCase()
      const driverB = getDriverName(b.driver_id).toLowerCase()
      return driverA.localeCompare(driverB)
    })


  const filteredArchivedJobs = archivedJobs
    // text search
    .filter(job =>
      Object.values(job).some(val =>
        String(val).toLowerCase().includes(archivedSearch.toLowerCase())
      )
    )
    // paid filter
    .filter(job => {
      if (archivedPaidFilter === 'All') return true
      return archivedPaidFilter === 'Paid' ? job.paid === true : job.paid === false
    })
    // payment type
    .filter(job => {
      if (archivedPaymentTypeFilter === 'All') return true
      return job.payment_type === archivedPaymentTypeFilter
    })
    // driver
    .filter(job => {
      if (!archivedDriverFilter) return true
      return job.driver_id === archivedDriverFilter
    })
    // date
    .filter(job => {
      if (!archivedDateFilter) return true
      return job.date_of_service === archivedDateFilter
    })
    // sort by driver name (like main table)
    .sort((a, b) => {
      const da = getDriverName(a.driver_id).toLowerCase()
      const db = getDriverName(b.driver_id).toLowerCase()
      return da.localeCompare(db)
    })

  return (
    <div className="admin-page bg-gradient-to-br from-white to-slate-100 min-h-screen px-4 py-6 text-sm relative">
      <button
        onClick={handleLogout}
        className="btn-bubbly absolute top-4 right-6 text-sm px-4 py-2"
      >
        Log Out
      </button>

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-sm text-gray-500">
          <button onClick={() => navigate('/admin-dashboard')} className="hover:underline">
            ← Back to Admin Dashboard
          </button>
        </div>

        <div className="text-center">
          <button
            className="btn-bubbly text-lg px-6 py-3"
            onClick={() => setActiveModal('add')}
          >
            Add New Booking
          </button>
        </div>

        <input
          type="text"
          placeholder="Search jobs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 rounded border focus:outline-none"
        />

        <div className="flex flex-wrap gap-4 my-4">

          {/* Paid Filter */}
          <select
            className="p-2 rounded border"
            value={paidFilter}
            onChange={(e) => setPaidFilter(e.target.value)}
          >
            <option value="All">All Jobs</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
          </select>

          {/* Payment Type Filter */}
          <select
            className="p-2 rounded border"
            value={paymentTypeFilter}
            onChange={(e) => setPaymentTypeFilter(e.target.value)}
          >
            <option value="All">All Payment Types</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Invoice">Invoice</option>
            <option value="Cheque">Cheque</option>
            <option value="BACS">BACS</option>
            <option value="SumUp">SumUp</option>
            <option value="TBD">TBD</option>

          </select>

          {/* Driver Filter */}
          <select
            className="p-2 rounded border"
            value={selectedDriverFilter}
            onChange={(e) => setSelectedDriverFilter(e.target.value)}
          >
            <option value="">All Drivers</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>{driver.name}</option>
            ))}
          </select>

          {/* Date Filter */}
          <input
            type="date"
            className="p-2 rounded border"
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
          />
        </div>


        <div className="overflow-x-auto max-h-[500px] overflow-y-auto border rounded">
          <table className="min-w-full table-auto border-collapse">
            <thead className="bg-gray-200 sticky top-0 z-10">
              <tr>
                <th className="border px-3 py-2">Job ID</th>
                <th className="border px-3 py-2">Job Type</th>
                <th className="border px-3 py-2">Address Line 1</th>
                <th className="border px-3 py-2">Postcode</th>
                <th className="border px-3 py-2">Date of Service</th>
                <th className="border px-3 py-2">Assigned Driver</th>
                <th className="border px-3 py-2">Order</th>
                <th className="border px-3 py-2">Job Complete</th>
                <th className="border px-3 py-2">Paid</th>
                <th className="border px-3 py-2">Invoice Required</th>
                <th className="border px-3 py-2">Invoice Sent</th>
                <th className="border px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job.id} className="text-sm">
                  <td className="border px-3 py-2">{job.id}</td>
                  <td className="border px-3 py-2">{job.job_type}</td>
                  <td className="border px-3 py-2">{job.address_line_1}</td>
                  <td className="border px-3 py-2">{job.post_code}</td>
                  <td className="border px-3 py-2">{job.date_of_service}</td>
                  <td className="border px-3 py-2">
                    <select
                      className="p-1 rounded border"
                      value={job.driver_id || ''}
                      onChange={(e) => updateAssignedDriver(job.id, e.target.value)}
                    >
                      <option value="">Select Driver</option>
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border px-3 py-2">
                    <select
                      className="p-1 rounded border w-20"
                      value={job.job_order || ''}
                      onChange={(e) => updateJobOrder(job.id, Number(e.target.value))}
                    >
                      <option value="">-</option>
                      {[...Array(20)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border px-3 py-2">
                    <select
                      className="p-1 rounded border"
                      value={job.job_complete ? 'Yes' : 'No'}
                      onChange={(e) =>
                        updateJobField(job.id, 'job_complete', e.target.value === 'Yes')
                      }
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </td>
                  <td className="border px-3 py-2">
                    <select
                      className="p-1 rounded border"
                      value={job.paid ? 'Yes' : 'No'}
                      onChange={(e) =>
                        updateJobField(job.id, 'paid', e.target.value === 'Yes')
                      }
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </td>
                  <td className="border px-3 py-2">
                    <select
                      className="p-1 rounded border"
                      value={job.invoice_required ? 'Yes' : 'No'}
                      onChange={(e) =>
                        updateJobField(job.id, 'invoice_required', e.target.value === 'Yes')
                      }
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </td>
                  <td className="border px-3 py-2">
                    <select
                      className="p-1 rounded border"
                      value={job.invoice_sent ? 'Yes' : 'No'}
                      onChange={(e) =>
                        updateJobField(job.id, 'invoice_sent', e.target.value === 'Yes')
                      }
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </td>
                  <td className="border px-3 py-2">
                    <div className="flex gap-2 flex-nowrap">
                      <button className="btn-bubbly text-xs px-3 py-1" onClick={() => handleEdit(job)}>Edit</button>
                      {wtns[job.id] ? (
                        <button className="btn-bubbly text-xs px-3 py-1" onClick={() => handleNewWTN(job)}>Edit WTN</button>
                      ) : (
                        <button className="btn-bubbly text-xs px-3 py-1" onClick={() => handleNewWTN(job)}>New WTN</button>
                      )}
                      <button className="btn-bubbly text-xs px-3 py-1" onClick={() => handleArchive(job)}>Archive</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Archived Jobs Toggle */}
        <div className="text-center mt-10">
          <button
            className="btn-bubbly px-4 py-2 text-sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? 'Hide Archived Jobs' : 'Show Archived Jobs'}
          </button>
        </div>

        {showArchived && (
          <>
            <input
              type="text"
              placeholder="Search archived jobs..."
              value={archivedSearch}
              onChange={(e) => setArchivedSearch(e.target.value)}
              className="w-full p-3 mt-6 rounded border focus:outline-none"
            />

            {/* Archived filters (same as main) */}
            <div className="flex flex-wrap gap-4 my-4">
              {/* Paid Filter */}
              <select
                className="p-2 rounded border"
                value={archivedPaidFilter}
                onChange={(e) => setArchivedPaidFilter(e.target.value)}
              >
                <option value="All">All Jobs</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>

              {/* Payment Type Filter */}
              <select
                className="p-2 rounded border"
                value={archivedPaymentTypeFilter}
                onChange={(e) => setArchivedPaymentTypeFilter(e.target.value)}
              >
                <option value="All">All Payment Types</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Invoice">Invoice</option>
                <option value="Cheque">Cheque</option>
                <option value="BACS">BACS</option>
                <option value="SumUp">SumUp</option>
                <option value="TBD">TBD</option>
              </select>

              {/* Driver Filter */}
              <select
                className="p-2 rounded border"
                value={archivedDriverFilter}
                onChange={(e) => setArchivedDriverFilter(e.target.value)}
              >
                <option value="">All Drivers</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.name}</option>
                ))}
              </select>

              {/* Date Filter */}
              <input
                type="date"
                className="p-2 rounded border"
                value={archivedDateFilter}
                onChange={(e) => setArchivedDateFilter(e.target.value)}
              />
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="min-w-full table-auto border-collapse">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="border px-3 py-2">Job ID</th>
                    <th className="border px-3 py-2">Job Type</th>
                    <th className="border px-3 py-2">Postcode</th>
                    <th className="border px-3 py-2">Date of Service</th>
                    <th className="border px-3 py-2">Assigned Driver</th>
                    <th className="border px-3 py-2">Job Complete</th>
                    <th className="border px-3 py-2">Payment Type</th>
                    <th className="border px-3 py-2">Paid</th>
                    <th className="border px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArchivedJobs.map((job) => (
                    <tr key={job.id} className="text-sm">
                      <td className="border px-3 py-2">{job.id}</td>
                      <td className="border px-3 py-2">{job.job_type}</td>
                      <td className="border px-3 py-2">{job.post_code}</td>
                      <td className="border px-3 py-2">{job.date_of_service}</td>
                      <td className="border px-3 py-2">{getDriverName(job.driver_id)}</td>
                      <td className="border px-3 py-2">{job.job_complete ? 'Yes' : 'No'}</td>
                      <td className="border px-3 py-2">{job.payment_type}</td>
                      <td className="border px-3 py-2">{job.paid ? 'Yes' : 'No'}</td>
                      <td className="border px-3 py-2">
                        <button
                          className="btn-bubbly text-xs px-3 py-1"
                          onClick={() => {
                            setSelectedJob(job)
                            setActiveModal('viewArchived')
                          }}
                        >
                          View/Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {activeModal === 'edit' && selectedJob && (
        <EditModal job={selectedJob} onClose={() => setActiveModal(null)} onSave={fetchJobs} />
      )}
      {activeModal === 'createWtn' && selectedJob && (
        <NewWTN jobId={selectedJob.id} onClose={() => setActiveModal(null)} onSubmit={() => {
          setActiveModal(null)
          fetchJobs()
          fetchWTNs()
        }} />
      )}
      {activeModal === 'editWtn' && selectedWTN && (
        <EditWTN wtn={selectedWTN} onClose={() => setActiveModal(null)} onSubmit={() => {
          setActiveModal(null)
          fetchJobs()
          fetchWTNs()
        }} />
      )}
      {activeModal === 'viewWtn' && wtnPDFUrl && (
        <ViewWTNPDFModal pdfUrl={wtnPDFUrl} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'viewArchived' && (
        <ViewEditArchivedJobModal job={selectedJob} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'add' && (
        <NewBookingModal
          onClose={() => setActiveModal(null)}
          onSave={() => {
            setActiveModal(null)
            fetchJobs()
          }}
        />
      )}
    </div>
  )
}
