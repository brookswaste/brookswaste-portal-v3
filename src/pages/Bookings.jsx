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
import jsPDF from 'jspdf'

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
    const { id: originalJobId, ...jobData } = job;

    // 1) Insert archived job first and get its id (or fetch it after)
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
      .select('id')        // RLS must allow SELECT for this to return data
      .maybeSingle();

    if (insertArchivedJobErr) {
      console.error('[Archive] Insert archived job error:', insertArchivedJobErr);
      alert('Could not archive the job (see console).');
      return;
    }

    if (insertedJob?.id) {
      archivedJobId = insertedJob.id;
    } else {
      // Fallback if RLS hid the returning row: find the row we just inserted
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

    // 2) Fetch live WTNs
    const { data: wtNotes, error: wtnFetchErr } = await supabase
      .from('waste_transfer_notes')
      .select('*')
      .eq('job_id', originalJobId);

    if (wtnFetchErr) {
      console.error('[Archive] Fetch WTN error:', wtnFetchErr);
      // Optional: clean up the archived job if you want atomicity
      // await supabase.from('archived_jobs').delete().eq('id', archivedJobId);
      alert('Could not fetch the WTN for this job. Archive aborted.');
      return;
    }

    // 3) Copy WTNs into archived table, linking to archived job
    if (wtNotes?.length) {
      const rows = wtNotes.map(({ id: original_wtn_id, created_at, updated_at, ...rest }) => ({
        ...rest,                             // original WTN fields
        job_id: originalJobId,               // keep original job id for reference
        original_wtn_id,                     // remember original WTN id
        archived_job_id: archivedJobId,      // << crucial: NOT NULL column
        archived_at: new Date().toISOString()
      }));

      const { error: insertArchivedWtnErr } = await supabase
        .from('archived_waste_transfer_notes')
        .insert(rows);

      if (insertArchivedWtnErr) {
        console.error('[Archive] Insert archived WTN error:', insertArchivedWtnErr);
        // Optional: rollback archived job
        // await supabase.from('archived_jobs').delete().eq('id', archivedJobId);
        alert('Could not archive the WTN (see console). Archive aborted.');
        return;
      }

      // 4) Delete live WTNs after archiving
      const { error: delLiveWtnErr } = await supabase
        .from('waste_transfer_notes')
        .delete()
        .in('id', wtNotes.map(w => w.id));

      if (delLiveWtnErr) {
        console.error('[Archive] Delete live WTN error:', delLiveWtnErr);
        alert('Archived, but failed to delete the live WTN (see console).');
        // Continue anyway
      }
    }

    // 5) Delete the live job
    const { error: delJobErr } = await supabase
      .from('jobs')
      .delete()
      .eq('id', originalJobId);

    if (delJobErr) {
      console.error('[Archive] Delete live job error:', delJobErr);
      alert('Archived, but failed to delete the live job (see console).');
      return;
    }

    // 6) Refresh UI
    fetchJobs();
    fetchArchivedJobs();
  };

  const handleEdit = (job) => {
    setSelectedJob(job)
    setActiveModal('edit')
  }

  // Build & download a WTN PDF for an archived job
  const handleDownloadArchivedWTN = async (archivedJob) => {
    // Prefer the original job id saved when archiving (see step 2)
    const jobRef = archivedJob.original_job_id ?? archivedJob.id;

    // 1) Try archived WTNs first
    let { data: wtn, error } = await supabase
      .from('archived_waste_transfer_notes')
      .select('*')
      .eq('job_id', jobRef)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2) Fallback to live WTNs
    if (error || !wtn) {
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

    const loadImage = (src) =>
      new Promise((resolve, reject) => {
        if (!src) return resolve(null);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    try {
      const logoImg = await loadImage('/images/brooks-logo.png');
      if (logoImg) doc.addImage(logoImg, 'PNG', 150, 10, 40, 0);
    } catch (_) {}

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor('#000000');
    doc.text('Brooks Waste – Sewage Specialist', 10, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Kendale The Drive, Rayleigh Essex, SS6 8XQ', 10, 21);
    doc.text('01268776126 · info@brookswaste.co.uk · www.brookswaste.co.uk', 10, 26);
    doc.text('Waste Carriers Reg #: CBDU167551', 10, 31);

    let y = 40;
    const box = (label, value) => {
      doc.setDrawColor(100);
      doc.setLineWidth(0.2);
      doc.rect(10, y, 190, 8);
      doc.setFontSize(10);
      doc.text(`${label}: ${value ?? '-'}`, 12, y + 5);
      y += 10;
    };

    box('Job ID', wtn.job_id);
    box('Date of Service', wtn.date_of_service ?? archivedJob?.date_of_service ?? '-');
    box('Client Name', wtn.client_name);
    box('Client Telephone', wtn.client_telephone);
    box('Client Email', wtn.client_email);
    box('Client Address', wtn.client_address);
    box('Site Address', wtn.site_address);
    box('Vehicle Registration', wtn.vehicle_registration);
    box('Waste Containment', wtn.waste_containment);
    box('SIC Code', wtn.sic_code);
    box('EWC', wtn.ewc);
    box('Waste Description', wtn.waste_description);
    box('Amount Removed', wtn.amount_removed);
    box('Disposal Address', wtn.disposal_address);
    box('Job Description', wtn.job_description);
    box('Driver Name', wtn.driver_name);
    box('Customer Name', wtn.customer_name);

    // Signatures
    y += 15;
    if (y > 250) y = 250;

    const signatureHeight = 30;
    const signatureWidth = 60;

    doc.setFontSize(10);
    doc.text('Driver Signature:', 10, y);
    doc.text('Customer Signature:', 110, y);

    try {
      const opSig = await loadImage(wtn.operative_signature);
      if (opSig) doc.addImage(opSig, 'PNG', 10, y + 5, signatureWidth, signatureHeight);
    } catch (_) {}

    try {
      const custSig = await loadImage(wtn.customer_signature);
      if (custSig) doc.addImage(custSig, 'PNG', 110, y + 5, signatureWidth, signatureHeight);
    } catch (_) {}

    // Footer
    doc.setTextColor('#000');
    doc.setFontSize(7);
    doc.text(
      'You are signing to say you have read the above details and that they are correct and the operative has completed the job to a satisfactory standard. Brooks Waste ltd takes no responsibility for any damage done to your property where access is not suitable for a tanker. Please see our full terms and conditions on brookswaste.co.uk - Registered in England 06747484 Registered Office: 4 Chester Court, Chester Hall Lane Basildon, Essex SS14 3WR',
      10,
      282,
      { maxWidth: 190 }
    );

    doc.save(`WTN_Job_${wtn.job_id}.pdf`);
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
                        <button
                          className="btn-bubbly text-xs px-3 py-1 ml-2"
                          onClick={() => handleDownloadArchivedWTN(job)}
                        >
                          WTN PDF
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
        <ViewEditArchivedJobModal job={selectedJob} onClose={() => setActiveModal(null)} onSave={fetchArchivedJobs} />
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
