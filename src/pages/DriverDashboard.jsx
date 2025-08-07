import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import NewWTN from '../components/NewWTN'

export default function DriverDashboard() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [jobs, setJobs] = useState([])
  const [archivedJobs, setArchivedJobs] = useState([])
  const [expandedJobId, setExpandedJobId] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showWTNModalForJob, setShowWTNModalForJob] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)

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

    const { data: activeJobs } = await supabase
      .from('jobs')
      .select('*')
      .eq('driver_id', driver.id)

    const { data: archived } = await supabase
      .from('archived_jobs')
      .select('*')
      .eq('driver_id', driver.id)

    setJobs((activeJobs || []).sort((a, b) => (a.job_order || 999) - (b.job_order || 999)))
    setArchivedJobs(archived || [])
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

  const toggleExpand = (jobId) => {
    setExpandedJobId(expandedJobId === jobId ? null : jobId)
  }

  const renderBoolIcon = (val) => {
    if (val === true) return '✅'
    if (val === false) return '❌'
    return '–'
  }

  return (
    <div className="bg-wrap bg-gradient-to-br from-white to-slate-100 min-h-screen px-4 py-6 relative">
      <button onClick={handleLogout} className="btn-bubbly absolute top-4 right-6 text-sm px-4 py-2">
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
          <div className="mb-4 flex items-center gap-2">
            <label className="text-sm font-medium">Filter by Date of Service:</label>
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={selectedDate || ''}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="text-xs text-blue-600 underline"
              >
                Clear
              </button>
            )}
          </div>
          {jobs.filter(j => !j.job_complete).length === 0 ? (
            <p className="text-gray-500">No current jobs assigned.</p>
          ) : (
            jobs
              .filter(j => !j.job_complete)
              .filter(j => !selectedDate || j.date_of_service === selectedDate)
              .map(job => (
              <div key={job.id} className="card-glass mb-4 p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">
                      {job.job_order ? `#${job.job_order} – ` : ''}{job.job_type}
                    </p>
                    <p className="text-sm text-gray-600">{job.post_code}</p>
                    <p className="text-sm text-gray-600">{job.mobile_number}</p>
                  </div>
                  <button className="btn-bubbly text-xs" onClick={() => toggleExpand(job.id)}>
                    {expandedJobId === job.id ? 'Hide Details' : 'View Details'}
                  </button>
                </div>

                {expandedJobId === job.id && (
                  <div className="text-sm text-gray-700 mt-4 space-y-1">
                    {Object.entries(job).map(([key, value]) => {
                      if (key === 'created_at' || key === 'driver_id') return null
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

                    {/* WTN + Complete Logic */}
                    {!job.waste_transfer_note_complete ? (
                      <button
                        className="btn-bubbly text-xs bg-yellow-500 hover:bg-yellow-600 mt-2"
                        onClick={() => setShowWTNModalForJob(job.id)}
                      >
                        New WTN
                      </button>
                    ) : (
                      <button
                        className="btn-bubbly text-xs bg-green-600 hover:bg-green-700 mt-2"
                        onClick={() => markJobComplete(job.id)}
                      >
                        Mark Complete
                      </button>
                    )}

                    {/* Mark as Paid */}
                    {!job.paid && (
                      <button
                        className="btn-bubbly text-xs bg-lime-400 hover:bg-lime-500 mt-2 ml-2"
                        onClick={() => markJobPaid(job.id)}
                      >
                        Mark as Paid
                      </button>
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
                      <p className="text-sm text-gray-600">{job.mobile_number}</p>
                    </div>
                    <button className="btn-bubbly text-xs" onClick={() => toggleExpand(job.id)}>
                      {expandedJobId === job.id ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>

                  {expandedJobId === job.id && (
                    <div className="text-sm text-gray-700 mt-4 space-y-1">
                      {Object.entries(job).map(([key, value]) => (
                        <p key={key}>
                          <strong>{key.replace(/_/g, ' ')}:</strong>{' '}
                          {typeof value === 'boolean'
                            ? renderBoolIcon(value)
                            : value === null || value === ''
                            ? '–'
                            : String(value)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )
          )}
        </div>

        {/* Archived Jobs */}
        <div className="mb-8">
          <h2
            className="text-lg font-semibold mb-3 cursor-pointer underline"
            onClick={() => setShowArchived(!showArchived)}
          >
            📦 Archived Jobs {showArchived ? '▲' : '▼'}
          </h2>

          {showArchived && (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm text-left text-gray-700 bg-white rounded-md">
                <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Job Type</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">Post Code</th>
                    <th className="px-4 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedJobs.map(job => (
                    <tr key={job.id} className="border-b">
                      <td className="px-4 py-2">{job.job_type}</td>
                      <td className="px-4 py-2">{job.customer_name}</td>
                      <td className="px-4 py-2">{job.post_code}</td>
                      <td className="px-4 py-2">{job.date_of_service}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showWTNModalForJob && (
        <NewWTN
          jobId={showWTNModalForJob}
          onClose={() => setShowWTNModalForJob(null)}
          onSubmit={() => {
            setShowWTNModalForJob(null)
            fetchDriverJobs()
          }}
        />
      )}
    </div>
  )
}
