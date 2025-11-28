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
import generateWTNPDF from '../utils/generateWTNPDF'

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
    const { data: existing } = await supabase
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
    const { id: originalJobId, ...jobData } = job;

    // 1) Insert archived job
    const archivedJobRow = {
      ...jobData,
      job_order: job.job_order || null,
      original_job_id: originalJobId,
      archived_at: new Date().toISOString(),
    };

    let archivedJobId = null;

    const { data: insertedJob, error: insertArchivedJobErr } = await supabase
      .from('archived_jobs')
      .insert([archivedJobRow])
      .select('id')
      .maybeSingle();

    if (insertArchivedJobErr) {
      console.error('[Archive] Insert archived job error:', insertArchivedJobErr);
      alert('Could not archive the job (see console).');
      return;
    }

    if (insertedJob?.id) {
      archivedJobId = insertedJob.id;
    } else {
      const { data: fallback, error: fbErr } = await supabase
        .from('archived_jobs')
        .select('id')
        .eq('original_job_id', originalJobId)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fbErr || !fallback?.id) {
        console.error('[Archive] Could not retrieve archived job id', fbErr);
        alert('Archived job created, but could not fetch its id (RLS?).');
        return;
      }
      archivedJobId = fallback.id;
    }

    // 2) Copy WTNs into archived table
    const { data: wtNotes, error: wtnFetchErr } = await supabase
      .from('waste_transfer_notes')
      .select('*')
      .eq('job_id', originalJobId);

    if (wtnFetchErr) {
      console.error('[Archive] Fetch WTN error:', wtnFetchErr);
      alert('Could not fetch the WTN for this job. Archive aborted.');
      return;
    }

    if (wtNotes?.length) {
      const rows = wtNotes.map(({ id: original_wtn_id, created_at, updated_at, ...rest }) => ({
        ...rest,
        job_id: originalJobId,
        original_wtn_id,
        archived_job_id: archivedJobId,
        archived_at: new Date().toISOString()
      }));

      const { error: insertArchivedWtnErr } = await supabase
        .from('archived_waste_transfer_notes')
        .insert(rows);

      if (insertArchivedWtnErr) {
        console.error('[Archive] Insert archived WTN error:', insertArchivedWtnErr);
        alert('Could not archive the WTN (see console). Archive aborted.');
        return;
      }

      const { error: delLiveWtnErr } = await supabase
        .from('waste_transfer_notes')
        .delete()
        .in('id', wtNotes.map(w => w.id));

      if (delLiveWtnErr) {
        console.error('[Archive] Delete live WTN error:', delLiveWtnErr);
        alert('Archived, but failed to delete the live WTN (see console).');
      }
    }

    // 3) Delete live job
    const { error: delJobErr } = await supabase
      .from('jobs')
      .delete()
      .eq('id', originalJobId);

    if (delJobErr) {
      console.error('[Archive] Delete live job error:', delJobErr);
      alert('Archived, but failed to delete the live job (see console).');
      return;
    }

    // 4) Refresh UI
    fetchJobs();
    fetchArchivedJobs();
  };

  const handleEdit = (job) => {
    setSelectedJob(job)
    setActiveModal('edit')
  }

  const handleDownloadArchivedWTN = async (archivedJob) => {
    const jobRef = archivedJob.original_job_id ?? archivedJob.id;

    // Try to fetch archived WTN
    let { data: wtn } = await supabase
      .from('archived_waste_transfer_notes')
      .select('*')
      .eq('job_id', jobRef)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fallback to live table if not found
    if (!wtn) {
      const res2 = await supabase
        .from('waste_transfer_notes')
        .select('*')
        .eq('job_id', jobRef)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      wtn = res2.data;
    }

    if (!wtn) {
      alert('No WTN found for this archived job.');
      return;
    }

    // 🔥 CENTRALIZED PDF GENERATOR
    generateWTNPDF(wtn)
  };

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
    .filter(job =>
      Object.values(job).some(val =>
        String(val).toLowerCase().includes(archivedSearch.toLowerCase())
      )
    )
    .filter(job => {
      if (archivedPaidFilter === 'All') return true
      return archivedPaidFilter === 'Paid' ? job.paid === true : job.paid === false
    })
    .filter(job => {
      if (archivedPaymentTypeFilter === 'All') return true
      return job.payment_type === archivedPaymentTypeFilter
    })
    .filter(job => {
      if (!archivedDriverFilter) return true
      return job.driver_id === archivedDriverFilter
    })
    .filter(job => {
      if (!archivedDateFilter) return true
      return job.date_of_service === archivedDateFilter
    })
    .sort((a, b) => {
      const da = getDriverName(a.driver_id).toLowerCase()
      const db = getDriverName(b.driver_id).toLowerCase()
      return da.localeCompare(db)
    })

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-slate-100 pt-16 relative">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b z-50">
        <div className="mx-auto max-w-screen-lg px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/brooks-logo.png" alt="Brooks Waste" className="h-8" />
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-sm font-semibold text-black">Bookings</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setActiveModal('add')}
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

      <div className="mx-auto max-w-screen-lg px-4 py-6 space-y-6">
        {/* Back Link */}
        <div className="text-sm text-gray-500">
          <button onClick={() => navigate('/admin-dashboard')} className="hover:underline">
            ← Back to Admin Dashboard
          </button>
        </div>

        {/* Search + Filters */}
        <div className="rounded-2xl bg-white shadow-sm border p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Search jobs…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="md:col-span-2 p-2 rounded border w-full focus:outline-none focus:ring-2 focus:ring-pink-400"
            />

            <select
              className="p-2 rounded border"
              value={paidFilter}
              onChange={(e) => setPaidFilter(e.target.value)}
            >
              <option value="All">All Jobs</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>

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

            <input
              type="date"
              className="p-2 rounded border"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
            />
          </div>
        </div>

        {/* --- LIVE JOBS TABLE --- */}
        <div className="rounded-2xl bg-white shadow-sm border overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-pink-50 sticky top-0 z-10">
              <tr className="text-left text-xs font-semibold text-black uppercase tracking-wider">
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
                <tr key={job.id} className="text-sm hover:bg-pink-50">
                  <td className="border px-3 py-2">{job.id}</td>
                  <td className="border px-3 py-2">{job.job_type}</td>
                  <td className="border px-3 py-2">{job.address_line_1}</td>
                  <td className="border px-3 py-2">{job.post_code}</td>
                  <td className="border px-3 py-2">{job.date_of_service}</td>

                  {/* Driver assign */}
                  <td className="border px-3 py-2">
                    <select
                      className="p-1 rounded border"
                      value={job.driver_id || ''}
                      onChange={(e) => updateAssignedDriver(job.id, e.target.value)}
                    >
                      <option value="">Select Driver</option>
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>{driver.name}</option>
                      ))}
                    </select>
                  </td>

                  {/* Job Order */}
                  <td className="border px-3 py-2">
                    <select
                      className="p-1 rounded border w-20"
                      value={job.job_order || ''}
                      onChange={(e) => updateJobOrder(job.id, Number(e.target.value))}
                    >
                      <option value="">-</option>
                      {[...Array(20)].map((_, i) => (
                        <option key={i} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                  </td>

                  {/* Editable fields */}
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

                  {/* Action Buttons */}
                  <td className="border px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        className="btn btn-neutral btn-xs"
                        onClick={() => handleEdit(job)}
                      >
                        Edit
                      </button>

                      {/* WTN Button */}
                      {wtns[job.id] ? (
                        <button
                          className="btn btn-neutral btn-xs"
                          onClick={() => handleNewWTN(job)}
                        >
                          Edit WTN
                        </button>
                      ) : (
                        <button
                          className="btn btn-neutral btn-xs"
                          onClick={() => handleNewWTN(job)}
                        >
                          New WTN
                        </button>
                      )}

                      {/* Archive */}
                      <button
                        className="btn btn-neutral btn-xs"
                        onClick={() => handleArchive(job)}
                      >
                        Archive
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* --- Archived Section Toggle --- */}
        <div className="text-center">
          <button
            className="btn btn-neutral btn-sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? 'Hide Archived Jobs' : 'Show Archived Jobs'}
          </button>
        </div>

        {showArchived && (
          <>
            {/* Archived Filters */}
            <div className="rounded-2xl bg-white shadow-sm border p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Search archived jobs…"
                  value={archivedSearch}
                  onChange={(e) => setArchivedSearch(e.target.value)}
                  className="md:col-span-2 p-2 rounded border w-full focus:outline-none focus:ring-2 focus:ring-pink-400"
                />

                <select
                  className="p-2 rounded border"
                  value={archivedPaidFilter}
                  onChange={(e) => setArchivedPaidFilter(e.target.value)}
                >
                  <option value="All">All Jobs</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>

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

                <input
                  type="date"
                  className="p-2 rounded border"
                  value={archivedDateFilter}
                  onChange={(e) => setArchivedDateFilter(e.target.value)}
                />
              </div>
            </div>

            {/* Archived Table */}
            <div className="rounded-2xl bg-white shadow-sm border overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-pink-50">
                  <tr className="text-left text-xs font-semibold text-black uppercase tracking-wider">
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
                    <tr key={job.id} className="text-sm hover:bg-pink-50">
                      <td className="border px-3 py-2">{job.id}</td>
                      <td className="border px-3 py-2">{job.job_type}</td>
                      <td className="border px-3 py-2">{job.post_code}</td>
                      <td className="border px-3 py-2">{job.date_of_service}</td>
                      <td className="border px-3 py-2">{getDriverName(job.driver_id)}</td>
                      <td className="border px-3 py-2">{job.job_complete ? 'Yes' : 'No'}</td>
                      <td className="border px-3 py-2">{job.payment_type}</td>
                      <td className="border px-3 py-2">{job.paid ? 'Yes' : 'No'}</td>

                      <td className="border px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            className="btn btn-neutral btn-xs"
                            onClick={() => {
                              setSelectedJob(job)
                              setActiveModal('viewArchived')
                            }}
                          >
                            View / Edit
                          </button>

                          <button
                            className="btn btn-neutral btn-xs"
                            onClick={() => handleDownloadArchivedWTN(job)}
                          >
                            WTN PDF
                          </button>

                          <button
                            className="btn btn-neutral btn-xs"
                            onClick={async () => {
                              const { data: archivedWTN } = await supabase
                                .from('archived_waste_transfer_notes')
                                .select('*')
                                .eq('job_id', job.original_job_id ?? job.id)
                                .maybeSingle()

                              if (!archivedWTN) {
                                alert('No archived WTN found.')
                                return
                              }

                              setSelectedWTN(archivedWTN)
                              setActiveModal('editArchivedWtn')
                            }}
                          >
                            Edit Archived WTN
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredArchivedJobs.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-gray-500" colSpan={9}>
                        No archived jobs match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* --- MODALS --- */}
      {activeModal === 'edit' && selectedJob && (
        <EditModal
          job={selectedJob}
          onClose={() => setActiveModal(null)}
          onSave={fetchJobs}
        />
      )}

      {activeModal === 'createWtn' && selectedJob && (
        <NewWTN
          jobId={selectedJob.id}
          onClose={() => setActiveModal(null)}
          onSubmit={() => {
            setActiveModal(null)
            fetchJobs()
            fetchWTNs()
          }}
        />
      )}

      {activeModal === 'editWtn' && selectedWTN && (
        <EditWTN
          wtn={selectedWTN}
          onClose={() => setActiveModal(null)}
          onSubmit={() => {
            setActiveModal(null)
            fetchJobs()
            fetchWTNs()
          }}
        />
      )}

      {activeModal === 'editArchivedWtn' && selectedWTN && (
        <EditWTN
          wtn={selectedWTN}
          onClose={() => setActiveModal(null)}
          onSubmit={() => {
            setActiveModal(null)
            fetchArchivedJobs()
          }}
          tableName="archived_waste_transfer_notes"
        />
      )}

      {activeModal === 'viewArchived' && (
        <ViewEditArchivedJobModal
          job={selectedJob}
          onClose={() => setActiveModal(null)}
          onSave={fetchArchivedJobs}
        />
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
