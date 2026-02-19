import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import NewWTN from '../components/NewWTN'
import EditWTN from '../components/EditWTN'
import generateWTNPDF from '../utils/generateWTNPDF'
import jsPDF from 'jspdf'

export default function DriverDashboard() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [jobs, setJobs] = useState([])
  const [expandedJobId, setExpandedJobId] = useState(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showWTNModalForJob, setShowWTNModalForJob] = useState(null)
  const [editWTNData, setEditWTNData] = useState(null)
  const [acceptedWarning, setAcceptedWarning] = useState(false)
  const [archivedJobs, setArchivedJobs] = useState([])
  const [showArchived, setShowArchived] = useState(false)


  // 🔒 Keys to hide in BOTH sections
  const HIDE_KEYS = new Set([
    'id',
    'driver_id',
    'invoice_address',
    'date_of_collection',
    'portaloo_numbers',
    'created_at',
    'portaloo_colour',
    'date_invoice_sent',
    'email',
    'job_cost_ex_vat',
    'payment_type',
    'job_notes',
    'invoice_required',
    'invoice_sent',
    
  ])

  const fetchDriverJobs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: driver } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('id', user.id)
      .single()

    if (!driver) return
    setName(driver.name)

    const todayStr = new Date().toISOString().split('T')[0]

    const { data: activeJobs } = await supabase
      .from('jobs')
      .select('*')
      .eq('driver_id', driver.id)
      .eq('date_of_service', todayStr)

    setJobs((activeJobs || []).sort((a, b) => (a.job_order || 999) - (b.job_order || 999)))
  
    // ✅ Archived jobs (today only)
    const { data: archived, error: archivedErr } = await supabase
      .from('archived_jobs')
      .select('*')
      .eq('driver_id', driver.id)
      .eq('date_of_service', todayStr)
      .order('archived_at', { ascending: false })

    if (archivedErr) {
      console.error('Fetch archived jobs failed:', archivedErr)
      setArchivedJobs([])
    } else {
      setArchivedJobs(archived || [])
    }
  }

  useEffect(() => {
    fetchDriverJobs()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const markJobComplete = async (jobId) => {
    await supabase
      .from('jobs')
      .update({ job_complete: true })
      .eq('id', jobId)

    fetchDriverJobs()
  }

  const markJobPaid = async (jobId) => {
    await supabase
      .from('jobs')
      .update({ paid: true })
      .eq('id', jobId)

    fetchDriverJobs()
  }

  const abortJob = async (jobId) => {
    const ok = confirm('Abort this job? This will flag it as ABORTED until the office reviews it.')
    if (!ok) return

    const { error } = await supabase
      .from('jobs')
      .update({ job_aborted: true })
      .eq('id', jobId)

    if (error) {
      console.error('Abort job error:', error)
      alert('Failed to abort job.')
      return
    }

    fetchDriverJobs()
  }


  const toggleExpand = (jobId) => {
    setExpandedJobId(expandedJobId === jobId ? null : jobId)
  }

  const renderBoolIcon = (val) => {
    if (val === true) return '✅'
    if (val === false) return '❌'
    return '–'
  }

  const openEditWTN = async (jobId) => {
    const { data: wtn, error } = await supabase
      .from('waste_transfer_notes')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Fetch WTN failed:', error)
      alert('Could not load WTN to edit.')
      return
    }

    if (!wtn) {
      setShowWTNModalForJob(jobId)
      return
    }

    setEditWTNData(wtn)
  }

  const handleDownloadWTN = async (jobId) => {
    const { data: wtn, error } = await supabase
      .from('waste_transfer_notes')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !wtn) {
      alert('No WTN found for this job.')
      return
    }

    generateWTNPDF(wtn)
  }

    // ✅ Download WTN PDF for an archived job (today)
    const handleDownloadArchivedWTN = async (archivedJob) => {
      const originalJobId = archivedJob.original_job_id ?? archivedJob.id

      // Try archived WTN first
      let { data: wtn } = await supabase
        .from('archived_waste_transfer_notes')
        .select('*')
        .eq('job_id', originalJobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Fallback to live WTN just in case
      if (!wtn) {
        const res2 = await supabase
          .from('waste_transfer_notes')
          .select('*')
          .eq('job_id', originalJobId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        wtn = res2.data
      }

      if (!wtn) {
        alert('No WTN found for this archived job.')
        return
      }

      generateWTNPDF(wtn)
    }

  // Safety popup
  if (!acceptedWarning) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white max-w-lg w-full rounded-lg shadow-lg p-6 text-black">
          <h2 className="text-xl font-bold mb-4">🚨 Important</h2>
          <p className="mb-3">
            It is a violation of Brooks Waste policy and UK road safety regulations to interact with this system while operating a vehicle.
            Drivers must bring the vehicle to a complete stop in a safe location before using any features of this system.
          </p>
          <p className="mb-3">
            <strong>By continuing, you confirm that:</strong>
          </p>
          <ul className="list-disc ml-6 mb-3">
            <li>The vehicle is safely parked.</li>
            <li>You are not in control of a moving vehicle.</li>
            <li>You accept full responsibility for complying with road safety laws.</li>
          </ul>
          <p className="mb-6">Failure to comply may result in disciplinary action.</p>
          <button
            onClick={() => setAcceptedWarning(true)}
            className="btn btn-primary btn-md px-6 py-2"
          >
            Confirm
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-wrap bg-gradient-to-br from-white to-slate-100 min-h-screen px-4 py-6 relative">
      <button onClick={handleLogout} className="btn btn-primary btn-md absolute top-4 right-6 text-sm px-4 py-2">
        Log Out
      </button>

      <div className="max-w-3xl mx-auto">
        <div className="text-sm text-gray-500 mb-4">
          <button onClick={() => navigate('/')} className="hover:underline">
            ← Back to Login
          </button>
        </div>

        <div className="card-glass text-center mb-6">
          <h1 className="text-2xl font-bold text-black">Hello, {name || 'Driver'}</h1>
        </div>

        {/* Current Jobs */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">🟢 Current Jobs</h2>
          {jobs.filter(j => !j.job_complete).length === 0 ? (
            <p className="text-gray-500">No current jobs assigned.</p>
          ) : (
            jobs
              .filter(j => !j.job_complete)
              .map(job => (
                <div
                  key={job.id}
                  className={`card-glass mb-4 p-4 ${
                    job.job_aborted ? 'bg-red-200 border border-red-400' : ''
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">
                        {job.job_order ? `#${job.job_order} – ` : ''}{job.job_type}
                      </p>
                      <p className="text-sm text-gray-600">{job.post_code}</p>

                      {job.what3words ? (
                      <p className="text-sm text-gray-600">
                        <strong>w3w:</strong> {job.what3words}
                      </p>
                      ) : null}

                      <p className="text-sm text-gray-600">{job.mobile_number}</p>
                    </div>
                    <button className="btn btn-primary btn-md text-xs" onClick={() => toggleExpand(job.id)}>
                      {expandedJobId === job.id ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>

                  {expandedJobId === job.id && (
                    <div className="text-sm text-gray-700 mt-4 space-y-1">
                      {Object.entries(job).map(([key, value]) => {
                        if (HIDE_KEYS.has(key)) return null
                        return (
                          <p key={key}>
                            <strong>{key.replace(/_/g, ' ')}:</strong>{' '}
                            {typeof value === 'boolean'
                              ? renderBoolIcon(value)
                              : value === null || value === ''
                              ? '–'
                              : String(value)}
                          </p>
                        )
                      })}

                      {/* Payment Type */}
                      <div className="mt-3">
                        <label className="block text-sm text-gray-600 font-medium mb-1">Payment Type</label>
                        <select
                          value={job.payment_type || ''}
                          onChange={async (e) => {
                            const newVal = e.target.value || null
                            await supabase.from('jobs').update({ payment_type: newVal }).eq('id', job.id)
                            fetchDriverJobs()
                          }}
                          className="w-full p-2 border rounded"
                        >
                          <option value="">Select payment type</option>
                          <option value="Cash">Cash</option>
                          <option value="Card">Card</option>
                          <option value="Invoice">Invoice</option>
                          <option value="Cheque">Cheque</option>
                          <option value="BACS">BACS</option>
                          <option value="SumUp">SumUp</option>
                          <option value="TBD">TBD</option>
                        </select>
                      </div>

                      {/* Job Notes */}
                      <div className="mt-2">
                        <label className="block text-sm text-gray-600 font-medium mb-1">Job Notes</label>
                        <textarea
                          defaultValue={job.job_notes || ''}
                          onBlur={async (e) => {
                            await supabase.from('jobs').update({ job_notes: e.target.value }).eq('id', job.id)
                            fetchDriverJobs()
                          }}
                          className="w-full p-2 border rounded min-h-[100px]"
                        />
                      </div>

                      {job.job_aborted ? (
                        <div className="mt-2">
                          <p className="text-sm font-semibold text-red-700">
                            ⚠️ This job has been marked as ABORTED.
                          </p>
                        </div>
                      ) : (
                        <>
                          {!job.waste_transfer_note_complete ? (
                            <button
                              className="btn btn-primary btn-md text-xs bg-yellow-500 hover:bg-yellow-600 mt-2"
                              onClick={() => setShowWTNModalForJob(job.id)}
                            >
                              New WTN
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary btn-md text-xs bg-green-600 hover:bg-green-700 mt-2"
                              onClick={() => markJobComplete(job.id)}
                            >
                              Mark Complete
                            </button>
                          )}

                          {!job.paid && (
                            <button
                              className="btn btn-primary btn-md text-xs bg-lime-400 hover:bg-lime-500 mt-2 ml-2"
                              onClick={() => markJobPaid(job.id)}
                            >
                              Mark as Paid
                            </button>
                          )}

                          <button
                            className="btn btn-primary btn-md text-xs bg-red-700 hover:bg-red-800 mt-2 ml-2"
                            onClick={() => abortJob(job.id)}
                          >
                            Abort Job
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
          )}
        </div>

        {/* Completed Jobs */}
        <div className="mb-8">
          <h2
            className="text-lg font-semibold mb-3 cursor-pointer underline"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            ✅ Completed Jobs {showCompleted ? '▲' : '▼'}
          </h2>

          {showCompleted && (
            jobs.filter(j => j.job_complete).length === 0 ? (
              <p className="text-gray-500">No completed jobs yet.</p>
            ) : (
              jobs.filter(j => j.job_complete).map(job => (
                <div key={job.id} className="card-glass mb-4 p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{job.job_type}</p>
                      <p className="text-sm text-gray-600">{job.post_code}</p>

                      {job.what3words ? (
                      <p className="text-sm text-gray-600">
                        <strong>w3w:</strong> {job.what3words}
                      </p>
                      ) : null}

                      <p className="text-sm text-gray-600">{job.mobile_number}</p>
                    </div>
                    <button className="btn btn-primary btn-md text-xs" onClick={() => toggleExpand(job.id)}>
                      {expandedJobId === job.id ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>

                  {expandedJobId === job.id && (
                    <div className="text-sm text-gray-700 mt-4 space-y-1">
                      {Object.entries(job).map(([key, value]) => {
                        if (HIDE_KEYS.has(key)) return null
                        return (
                          <p key={key}>
                            <strong>{key.replace(/_/g, ' ')}:</strong>{' '}
                            {typeof value === 'boolean'
                              ? renderBoolIcon(value)
                              : value === null || value === ''
                              ? '–'
                              : String(value)}
                          </p>
                        )
                      })}

                      <button
                        className="btn btn-primary btn-md text-xs bg-amber-500 hover:bg-amber-600 mt-2"
                        onClick={() => openEditWTN(job.id)}
                      >
                        Edit WTN
                      </button>
                    </div>
                  )}
                </div>
              ))
            )
          )}
        </div>
        
        {/* ✅ Archived Jobs (Today) */}
        <div className="mb-8">
          <h2
            className="text-lg font-semibold mb-3 cursor-pointer underline"
            onClick={() => setShowArchived(!showArchived)}
          >
            📦 Archived Jobs {showArchived ? '▲' : '▼'}
          </h2>

          {showArchived && (
            archivedJobs.length === 0 ? (
              <p className="text-gray-500">No archived jobs for today.</p>
            ) : (
              archivedJobs.map((job) => (
                <div key={job.id} className="card-glass mb-4 p-4 opacity-90">
                  <div className="flex justify-between items-center gap-4">
                    <div>
                      <p className="font-semibold">{job.job_type}</p>

                      <p className="text-sm text-gray-600">
                        {job.address_line_1 || '—'}
                      </p>

                      <p className="text-sm text-gray-600">
                        {job.post_code || '—'}
                      </p>

                      <p className="text-sm text-gray-600">
                        {job.mobile_number || job.telephone_number || '—'}
                      </p>
                    </div>

                    <button
                      className="btn btn-neutral btn-md text-xs"
                      onClick={() => handleDownloadArchivedWTN(job)}
                    >
                      Download WTN PDF
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {showWTNModalForJob && (
        <NewWTN
          jobId={showWTNModalForJob}
          singleColumn
          onClose={() => setShowWTNModalForJob(null)}
          onSubmit={() => {
            setShowWTNModalForJob(null)
            fetchDriverJobs()
          }}
        />
      )}

      {editWTNData && (
        <EditWTN
          wtn={editWTNData}
          onClose={() => setEditWTNData(null)}
          onSubmit={() => {
            setEditWTNData(null)
            fetchDriverJobs()
          }}
        />
      )}
    </div>
  )
}
