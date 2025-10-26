import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import NewWTN from '../components/NewWTN'
import EditWTN from '../components/EditWTN'
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
    // existing exclusions already in your code:
    'payment_type',
    'job_notes',
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

    // Get today in YYYY-MM-DD format
    const todayStr = new Date().toISOString().split('T')[0]

    // Active jobs for today
    const { data: activeJobs } = await supabase
      .from('jobs')
      .select('*')
      .eq('driver_id', driver.id)
      .eq('date_of_service', todayStr)

    setJobs((activeJobs || []).sort((a, b) => (a.job_order || 999) - (b.job_order || 999)))
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

    // If no WTN exists yet, fall back to creating one
    if (!wtn) {
      setShowWTNModalForJob(jobId)
      return
    }

    setEditWTNData(wtn)
  }

  // Kept for future use (button removed in Completed Jobs)
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

    const loadImage = (src) =>
      new Promise((resolve, reject) => {
        if (!src) return resolve(null)
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
      })

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    try {
      const logoImg = await loadImage('/images/brooks-logo.png')
      if (logoImg) doc.addImage(logoImg, 'PNG', 150, 10, 40, 0)
    } catch (_) {}

    // Header
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor('#000000')
    doc.text('Brooks Waste – Sewage Specialist', 10, 15)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Kendale The Drive, Rayleigh Essex, SS6 8XQ', 10, 21)
    doc.text('01268776126 · info@brookswaste.co.uk · www.brookswaste.co.uk', 10, 26)
    doc.text('Waste Carriers Reg #: CBDU167551', 10, 31)

    let y = 40
    const box = (label, value) => {
      doc.setDrawColor(100)
      doc.setLineWidth(0.2)
      doc.rect(10, y, 190, 8)
      doc.setFontSize(10)
      doc.text(`${label}: ${value ?? '-'}`, 12, y + 5)
      y += 10
    }

    // Fields
    box('Job ID', wtn.job_id)
    box('Date of Service', wtn.date_of_service)
    box('Client Name', wtn.client_name)
    box('Client Telephone', wtn.client_telephone)
    box('Client Email', wtn.client_email)
    box('Client Address', wtn.client_address)
    box('Vehicle Registration', wtn.vehicle_registration)
    box('Waste Containment', wtn.waste_containment)
    box('SIC Code', wtn.sic_code)
    box('EWC', wtn.ewc)
    box('Waste Description', wtn.waste_description)
    box('Amount Removed', wtn.amount_removed)
    box('Disposal Address', wtn.disposal_address)
    box('Job Description', wtn.job_description)
    box('Driver Name', wtn.driver_name)
    box('Customer Name', wtn.customer_name)

    // Signatures
    y += 15
    if (y > 250) y = 250

    const signatureHeight = 30
    const signatureWidth = 60

    doc.setFontSize(10)
    doc.text('Driver Signature:', 10, y)
    doc.text('Customer Signature:', 110, y)

    try {
      const opSig = await loadImage(wtn.operative_signature)
      if (opSig) doc.addImage(opSig, 'PNG', 10, y + 5, signatureWidth, signatureHeight)
    } catch (_) {}

    try {
      const custSig = await loadImage(wtn.customer_signature)
      if (custSig) doc.addImage(custSig, 'PNG', 110, y + 5, signatureWidth, signatureHeight)
    } catch (_) {}

    y += signatureHeight + 15

    // Footer
    doc.setTextColor('#000')
    doc.setFontSize(7)
    doc.text(
      'You are signing to say you have read the above details and that they are correct and the operative has completed the job to a satisfactory standard. Brooks Waste ltd takes no responsibility for any damage done to your property where access is not suitable for a tanker. Please see our full terms and conditions on brookswaste.co.uk - Registered in England 06747484 Registered Office: 4 Chester Court, Chester Hall Lane Basildon, Essex SS14 3WR',
      10,
      282,
      { maxWidth: 190 }
    )

    doc.save(`WTN_Job_${wtn.job_id}.pdf`)
  } // ← closes handleDownloadWTN


  // Safety popup — block dashboard until confirmed
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
          <p className="mb-3">
            Failure to comply may result in disciplinary action.
          </p>
          <p className="mb-6">
            Click <strong>“Confirm”</strong> only if you are fully stationary.
          </p>
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
                <div key={job.id} className="card-glass mb-4 p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">
                        {job.job_order ? `#${job.job_order} – ` : ''}{job.job_type}
                      </p>
                      <p className="text-sm text-gray-600">{job.post_code}</p>
                      <p className="text-sm text-gray-600">{job.mobile_number}</p>
                    </div>
                    <button className="btn btn-primary btn-md text-xs" onClick={() => toggleExpand(job.id)}>
                      {expandedJobId === job.id ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>

                  {expandedJobId === job.id && (
                    <div className="text-sm text-gray-700 mt-4 space-y-1">
                      {/* Hide keys in Current Jobs */}
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

                      {/* Editable: Payment Type */}
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

                      {/* Editable: Job Notes (save on blur) */}
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

                      {/* WTN + Complete Logic */}
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

                      {/* Mark as Paid */}
                      {!job.paid && (
                        <button
                          className="btn btn-primary btn-md text-xs bg-lime-400 hover:bg-lime-500 mt-2 ml-2"
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
                    <button className="btn btn-primary btn-md text-xs" onClick={() => toggleExpand(job.id)}>
                      {expandedJobId === job.id ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>

                  {expandedJobId === job.id && (
                    <div className="text-sm text-gray-700 mt-4 space-y-1">
                      {/* Hide keys in Completed Jobs */}
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

                      {/* Only Edit WTN button */}
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
      </div>

      {showWTNModalForJob && (
        <NewWTN
          jobId={showWTNModalForJob}
          singleColumn   // ← force 1 field per row for drivers
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
