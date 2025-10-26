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

  // ▼ Add directly under renderBoolIcon
  const handleDownloadWTN = async (jobId) => {
    // 1) Get the latest WTN for this job
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

    // 2) Helper to load images (logo & signatures)
    const loadImage = (src) =>
      new Promise((resolve, reject) => {
        if (!src) return resolve(null)
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
      })

    // 3) Build PDF (mirrors EditWTN)
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

    // --- Flexible wrapping boxes for WTN PDF ---
    let y = 40;
    const PAGE_LEFT = 10;
    const PAGE_WIDTH = 190;
    const PAGE_BOTTOM = 282;
    const LINE_HEIGHT = 4.5;
    const BOX_VPAD = 2.5;
    const GAP = 2;
    const TEXT_X = PAGE_LEFT + 2;

    const ensureRoom = (height) => {
      if (y + height > PAGE_BOTTOM) {
        doc.addPage();
        y = 40;
      }
    };

    const addField = (label, value) => {
      const txt = `${label}: ${value ?? '-'}`;
      const wrapped = doc.splitTextToSize(txt, PAGE_WIDTH - 4);
      const boxHeight = BOX_VPAD * 2 + wrapped.length * LINE_HEIGHT;

      ensureRoom(boxHeight);

      doc.setDrawColor(100);
      doc.setLineWidth(0.2);
      doc.rect(PAGE_LEFT, y, PAGE_WIDTH, boxHeight);

      doc.setFontSize(10);
      let tY = y + BOX_VPAD + LINE_HEIGHT;
      wrapped.forEach((line, i) => {
        doc.text(line, TEXT_X, tY + i * LINE_HEIGHT);
      });

      y += boxHeight + GAP;
    };

    // --- Fields ---
    addField('Job ID', wtn.job_id);
    addField('Date of Service', wtn.date_of_service);
    addField('Client Name', wtn.client_name);
    addField('Client Telephone', wtn.client_telephone);
    addField('Client Email', wtn.client_email);
    addField('Client Address', wtn.client_address);
    addField('Vehicle Registration', wtn.vehicle_registration);
    addField('Waste Containment', wtn.waste_containment);
    addField('SIC Code', wtn.sic_code);
    addField('EWC', wtn.ewc);
    addField('Waste Description', wtn.waste_description);
    addField('Amount Removed', wtn.amount_removed);
    addField('Disposal Address', wtn.disposal_address);
    addField('Job Description', wtn.job_description);
    addField('Driver Name', wtn.driver_name);
    addField('Customer Name', wtn.customer_name);

    // --- Signatures (auto page-break aware) ---
    const SIG_W = 60;
    const SIG_H = 30;
    const SIG_LABEL_H = 5;

    ensureRoom(SIG_LABEL_H + SIG_H + 15);

    doc.setFontSize(10);
    doc.text('Driver Signature:', PAGE_LEFT, y);
    doc.text('Customer Signature:', PAGE_LEFT + 100, y);

    try {
      const opSig = await loadImage(wtn.operative_signature);
      if (opSig) doc.addImage(opSig, 'PNG', PAGE_LEFT, y + 5, SIG_W, SIG_H);
    } catch (_) {}

    try {
      const custSig = await loadImage(wtn.customer_signature);
      if (custSig) doc.addImage(custSig, 'PNG', PAGE_LEFT + 100, y + 5, SIG_W, SIG_H);
    } catch (_) {}

    y += SIG_H + 15;


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
                      {/* 1) Show all standard fields except payment_type & job_notes */}
                      {Object.entries(job).map(([key, value]) => {
                        if (['created_at', 'driver_id', 'payment_type', 'job_notes'].includes(key)) return null
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

                      {/* 2) Editable: Payment Type */}
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

                      {/* 3) Editable: Job Notes (save on blur) */}
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
                      <button
                        className="btn btn-primary btn-md text-xs bg-blue-600 hover:bg-blue-700 mt-2"
                        onClick={() => handleDownloadWTN(job.id)}
                      >
                        View / Download WTN PDF
                      </button>
                      <button
                        className="btn btn-primary btn-md text-xs bg-amber-500 hover:bg-amber-600 mt-2 ml-2"
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
