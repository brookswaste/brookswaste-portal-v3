import React, { useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { supabase } from '../supabaseClient'
import { v4 as uuidv4 } from 'uuid'
import jsPDF from 'jspdf'

const EWC_OPTIONS = [
  '13 05 – Oil/Water Separator Contents',
  '13 05 01* - Solids from Grit Chambers and Oil/Water Separators',
  '13 05 02* - Sludges from Oil/Water Separators',
  '13 05 03* - Interceptor Sludges',
  '13 05 06* - Oil from Oil/Water Separators',
  '13 05 07* - Oily Water from Oil/Water Separators',
  '13 05 08* - Mixtures of Waste from Grit Chambers and Oil/Water Separators',
  '16 03 – Off-Specification Batches and Unused Products',
  '16 03 03* - Inorganic Wastes Containing Hazardous Substances',
  '16 03 04 - Inorganic Wastes Other Than Those Mentioned in 16 03 03',
  '16 03 05* - Organic Wastes Containing Hazardous Substances',
  '16 03 06 – Organic Wastes Other Than Those Mentioned in 16 03 05',
  '16 10 – Aqueous Liquid Waste Destined for Off-Site Treatment',
  '16 10 01* - Aqueous Liquid Waste Containing Hazardous Substances',
  '16 10 02 - Aqueous Liquid Wastes Other Than Those Mentioned in 16 10 01',
  '16 10 03* - Aqueous Concentrates Containing Hazardous Substances',
  '16 10 04 - Aqueous Concentrates Other Than Those Mentioned In 16 10 03',
  '19 07 – Land Fill Leachate',
  '19 07 02* - Landfill Leachate Containing Hazardous Substances',
  '19 07 03 - Landfill Leachate Other Than Those Mentioned in 19 07 02',
  '19 08 – Waste from Waste Water Treatment Plant Not Otherwise Specified',
  '19 08 09 - Grease and Oil Mixture from Oil/Water Separation Containing Edible Oil and Fats',
  '19 08 10* - Grease and Oil Mixture from Oil/Water Separation Other Than Those Mentioned in 19 08 09',
  '19 12 – Waste from the Mechanical Treatment of Waste (E.g Sorting, Crushing, Compacting)',
  '19 12 11* - Other Wastes (Including Mixtures of Materials) from Mechanical Treatment of Waste Containing Hazardous Substances',
  '19 12 12 - Other Wastes (Including Mixtures of Materials) from Mechanical Treatment of Waste Other Than',
  '20 01 – Separately Collected Fractions (Except 15 01)',
  '20 01 25 - Edible Oil and Fat',
  '20 01 26* - Oil and Fat Other Than Those Mentioned in 20 01 25',
  '20 03 – Other Municipal Wastes',
  '20 03 03 - Street Cleaning Residues (Gully Waste)',
  '20 03 04 - Septic Tank Sludge',
  '20 03 06 - Waste from Sewage Cleaning',
  '20 03 99 - Municipal Waste Not Otherwise Specified'
];


export default function EditWTN({ wtn, onClose, onSubmit }) {
  const [formData, setFormData] = useState(null)
  const [loading, setLoading] = useState(false)
  const sigCanvas = useRef()

  useEffect(() => {
    if (wtn) {
      setFormData(wtn)
    }
  }, [wtn])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleUpdate = async () => {
    setLoading(true)
    const { id, ...payload } = formData
    // Require a valid EWC selection
    if (!payload.ewc || !EWC_OPTIONS.includes(payload.ewc)) {
      alert('Please select a valid EWC code.');
      setLoading(false);
      return;
    }

    if (!payload.signature && sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const signatureDataUrl = sigCanvas.current.toDataURL()
      const fileName = `signature-${uuidv4()}.png`
      const file = await (await fetch(signatureDataUrl)).blob()

      const { error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(`signatures/${fileName}`, file, { contentType: 'image/png' })

      if (uploadError) {
        alert('Signature upload failed')
        console.error(uploadError)
        setLoading(false)
        return
      }

      const { publicUrl } = supabase.storage.from('signatures').getPublicUrl(`signatures/${fileName}`)
      payload.signature = publicUrl
    }

    Object.keys(payload).forEach(key => {
      if (payload[key] === '') payload[key] = null
    })

    // Convert string to array if needed (for Supabase array fields)
    if (typeof payload.a1_ewc_codes === 'string') {
        payload.a1_ewc_codes = payload.a1_ewc_codes.split(',').map(item => item.trim())
    }
    if (typeof payload.b3_role === 'string') {
        payload.b3_role = payload.b3_role.split(',').map(item => item.trim())
    }

    if (!payload.created_by && formData.created_by) {
      payload.created_by = formData.created_by
    }

    console.log('Submitting payload:', payload)  // ✅ ADD THIS

    if (!formData?.id) {
      alert('WTN ID missing — cannot update')
      console.error('Missing WTN ID:', formData)
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('waste_transfer_notes')
      .update(payload)
      .eq('id', formData.id)

    if (!error) {
      onSubmit()
    } else {
      console.error('Update WTN error:', error)
      alert('Failed to update WTN.')
    }

    setLoading(false)
  }

  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Load and add Brooks Waste logo
    const logoImg = new Image();
    logoImg.src = '/images/brooks-logo.png';
    logoImg.onload = () => {
      doc.addImage(logoImg, 'PNG', 150, 10, 40, 0);

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor('#000000');
      doc.text('Brooks Waste – Sewage Specialist', 10, 14);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Kendale The Drive, Rayleigh Essex, SS6 8XQ', 10, 19);
      doc.text('01268776126 · info@brookswaste.co.uk · www.brookswaste.co.uk', 10, 23);
      doc.text('Waste Carriers Reg #: CBDU167551', 10, 27);

      let y = 36;

      const box = (label, value) => {
        doc.setDrawColor(100);
        doc.setLineWidth(0.15);
        doc.rect(10, y, 190, 6);
        doc.setFontSize(9);
        doc.text(`${label}: ${value ?? '-'}`, 12, y + 4);
        y += 7;
      };

      // New Fields
      box('Job ID', formData.job_id);
      box('Client Name', formData.client_name);
      box('Client Telephone', formData.client_telephone);
      box('Client Email', formData.client_email);
      box('Client Address', formData.client_address);
      box('Site Address', formData.site_address);
      box('Vehicle Registration', formData.vehicle_registration);
      box('Waste Containment', formData.waste_containment);
      box('SIC Code', formData.sic_code);
      box('EWC', formData.ewc);
      box('Waste Description', formData.waste_description);
      box('Amount Removed', formData.amount_removed);
      box('Disposal Address', formData.disposal_address);
      box('Job Description', formData.job_description);
      box('Portaloo Drop-off Date', formData.portaloo_dropoff_date);
      box('Portaloo Collection Date', formData.portaloo_collection_date);
      box('Time In', formData.time_in);
      box('Time Out', formData.time_out);
      box('Driver Name', formData.driver_name);
      box('Customer Name', formData.customer_name);
      
      // Add padding to separate signatures from the last field box
      y += 15;
      
      if (y > 250) y = 250;

      const signatureHeight = 30;
      const signatureWidth = 60;

      // Signatures section
      doc.setFontSize(10);
      doc.text('Driver Signature:', 10, y);
      doc.text('Customer Signature:', 110, y);

      if (formData.operative_signature) {
        doc.addImage(formData.operative_signature, 'PNG', 10, y + 5, signatureWidth, signatureHeight);
      }

      if (formData.customer_signature) {
        doc.addImage(formData.customer_signature, 'PNG', 110, y + 5, signatureWidth, signatureHeight);
      }

      // Move down after signatures
      y += signatureHeight + 15;

      // Footer
      doc.setTextColor('#000');
      doc.setFontSize(7);
      doc.text(
        'You are signing to say you have read the above details and that they are correct and the operative has completed the job to a satisfactory standard. Brooks Waste ltd takes no responsibility for any damage done to your property where access is not suitable for a tanker. Please see our full terms and conditions on brookswaste.co.uk - Registered in England 06747484 Registered Office: 4 Chester Court, Chester Hall Lane Basildon, Essex SS14 3WR',
        10,
        282,
        { maxWidth: 190 }
      );

      doc.save(`WTN_Job_${formData.job_id}.pdf`);
    };
  };

  if (!formData) return null

  const fields = [
    { name: 'client_name', label: 'Client Name' },
    { name: 'client_telephone', label: 'Client Telephone' },
    { name: 'client_email', label: 'Client Email' },
    { name: 'client_address', label: 'Client Address' },
    { name: 'site_address', label: 'Site Address' },
    { name: 'vehicle_registration', label: 'Vehicle Registration' },
    { name: 'waste_containment', label: 'Waste Containment' },
    { name: 'sic_code', label: 'SIC Code' },
    { name: 'ewc', label: 'EWC' },
    { name: 'waste_description', label: 'Waste Description' },
    { name: 'amount_removed', label: 'Amount Removed' },
    { name: 'disposal_address', label: 'Disposal Address' },
    { name: 'job_description', label: 'Job Description' },
    { name: 'portaloo_dropoff_date', label: 'Portaloo Drop-off Date', type: 'date' },
    { name: 'portaloo_collection_date', label: 'Portaloo Collection Date', type: 'date' },
    { name: 'time_in', label: 'Time In', type: 'time' },
    { name: 'time_out', label: 'Time Out', type: 'time' },
    { name: 'driver_name', label: 'Driver Name' },
    { name: 'customer_name', label: 'Customer Name' }
  ]

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="modal-glass bg-white p-6 rounded shadow w-full max-w-5xl">
        <h2 className="text-lg font-bold mb-4">Edit Waste Transfer Note</h2>

        <div className="grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto pr-3">
          {fields.map(({ name, label, type }) => (
            <div key={name}>
              <label className="text-xs text-gray-600">{label}</label>

              {name === 'ewc' ? (
                <select
                  name="ewc"
                  value={formData.ewc || ''}
                  onChange={handleChange}
                  required
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select EWC code…</option>
                  {EWC_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : type === 'checkbox' ? (
                <input
                  type="checkbox"
                  name={name}
                  checked={!!formData[name]}
                  onChange={handleChange}
                  className="ml-2"
                />
              ) : (
                <input
                  type={type || 'text'}
                  name={name}
                  value={formData[name] || ''}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">Driver Signature</h3>
            {formData.operative_signature ? (
              <img src={formData.operative_signature} alt="Driver Signature" className="border rounded w-64" />
            ) : (
              <p className="text-xs text-gray-500">No signature uploaded.</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-1">Customer Signature</h3>
            {formData.customer_signature ? (
              <img src={formData.customer_signature} alt="Customer Signature" className="border rounded w-64" />
            ) : (
              <p className="text-xs text-gray-500">No signature uploaded.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-bubbly" onClick={handleDownloadPDF}>
            Download PDF
          </button>
          <button className="btn-bubbly" disabled={loading} onClick={handleUpdate}>
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button className="btn-bubbly" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
