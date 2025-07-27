import React, { useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { supabase } from '../supabaseClient'
import { v4 as uuidv4 } from 'uuid'
import jsPDF from 'jspdf'

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

    // Permanent Header
    doc.setFillColor('#FFC0CB'); // Light pink background
    doc.rect(0, 0, 210, 25, 'F');
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

    box('Job ID', formData.job_id);
    box('Description', formData.a1_description);
    box('EWC Codes', Array.isArray(formData.a1_ewc_codes) ? formData.a1_ewc_codes.join(', ') : formData.a1_ewc_codes);
    box('Containment', formData.a2_containment);
    box('Quantity', formData.a3_quantity);
    box('Producer Name', formData.b1_name);
    box('Producer Company', formData.b1_company);
    box('Producer Address', formData.b1_address);
    box('Regulatory Authority', formData.b2_authority);
    box('Carrier Role', Array.isArray(formData.b3_role) ? formData.b3_role.join(', ') : formData.b3_role);
    box('Permit Number', formData.b3_permit_number);
    box('Carrier Reg. Number', formData.b3_carrier_reg_number);
    box('Receiver Name', formData.c1_name);
    box('Receiver Company', formData.c1_company);
    box('Receiver Address', formData.c1_address);
    box('Transfer Address', formData.d1_address);
    box('Date of Transfer', formData.d1_date);
    box('Broker Name', formData.d_broker_name);
    box('Broker Registration', formData.d_broker_registration);
    box('Signed by Hierarchy', formData.d_sign_hierarchy ? 'Yes' : 'No');

    // Signature
    if (formData.signature) {
      doc.text('Driver Signature:', 10, y + 5);
      doc.addImage(formData.signature, 'PNG', 10, y + 10, 60, 30);
      y += 45;
    }

    // Footer
    doc.setFillColor('#FFC0CB');
    doc.rect(0, 282, 210, 15, 'F');
    doc.setTextColor('#000');
    doc.setFontSize(7);
    doc.text(
      'You are signing to say you have read the above details and that they are correct and the operative has completed the job to a satisfactory standard. Brooks Waste ltd takes no responsibility for any damage done to your property where access is not suitable for a tanker. Please see our full terms and conditions on brookswaste.co.uk - Registered in England 06747484 Registered Office: 4 Chester Court, Chester Hall Lane Basildon, Essex SS14 3WR',
      10,
      287,
      { maxWidth: 190 }
    );

    doc.save(`WTN_Job_${formData.job_id}.pdf`);
  };

  if (!formData) return null

  const fields = [
    { name: 'a1_description', label: 'Description' },
    { name: 'a1_ewc_codes', label: 'EWC Codes' },
    { name: 'a2_containment', label: 'Containment' },
    { name: 'a3_quantity', label: 'Quantity' },
    { name: 'b1_name', label: 'Producer Name' },
    { name: 'b1_company', label: 'Producer Company' },
    { name: 'b1_address', label: 'Producer Address' },
    { name: 'b2_authority', label: 'Regulatory Authority' },
    { name: 'b3_role', label: 'Carrier Role' },
    { name: 'b3_permit_number', label: 'Permit Number' },
    { name: 'b3_carrier_reg_number', label: 'Carrier Reg. Number' },
    { name: 'c1_name', label: 'Receiver Name' },
    { name: 'c1_company', label: 'Receiver Company' },
    { name: 'c1_address', label: 'Receiver Address' },
    { name: 'd1_address', label: 'Transfer Address' },
    { name: 'd1_date', label: 'Date of Transfer', type: 'date' },
    { name: 'd_broker_name', label: 'Broker Name' },
    { name: 'd_broker_registration', label: 'Broker Registration' },
    { name: 'd_sign_hierarchy', label: 'Signed by Hierarchy?', type: 'checkbox' },
  ]

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="modal-glass bg-white p-6 rounded shadow w-full max-w-5xl">
        <h2 className="text-lg font-bold mb-4">Edit Waste Transfer Note</h2>

        <div className="grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto pr-3">
          {fields.map(({ name, label, type }) => (
            <div key={name}>
              <label className="text-xs text-gray-600">{label}</label>
              {type === 'checkbox' ? (
                <input
                  type="checkbox"
                  name={name}
                  checked={formData[name] || false}
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

        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-1">Driver Signature</h3>
          {formData.signature ? (
            <img src={formData.signature} alt="Signature" className="border rounded w-64" />
          ) : (
            <SignatureCanvas
              ref={sigCanvas}
              penColor="black"
              canvasProps={{ width: 400, height: 150, className: 'border rounded' }}
            />
          )}
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
