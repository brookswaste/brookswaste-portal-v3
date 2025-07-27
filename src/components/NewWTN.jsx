import React, { useRef, useState, useEffect } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { supabase } from '../supabaseClient'
import { v4 as uuidv4 } from 'uuid'

export default function NewWTN({ jobId, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    job_id: jobId,
    a1_description: '',
    a1_ewc_codes: '',
    a2_containment: '',
    a3_quantity: '',
    b1_name: '',
    b1_company: '',
    b1_address: '',
    b2_authority: '',
    b3_role: '',
    b3_permit_number: '',
    b3_carrier_reg_number: '',
    c1_name: '',
    c1_company: '',
    c1_address: '',
    d1_address: '',
    d1_date: '',
    d_broker_name: '',
    d_broker_registration: '',
    d_sign_hierarchy: false,
    signature: '',
    driver_id: null,
  })

  const [loading, setLoading] = useState(false)
  const sigCanvas = useRef()

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    const payload = { ...formData }

    // ✅ Fetch current user to get auth ID
    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
        alert('Unable to fetch user.')
        console.error(userError)
        setLoading(false)
        return
    }

    // ✅ Assign the user's auth ID as the creator
    payload.created_by = user.id

    // Handle signature upload if canvas used
    if (!payload.signature && sigCanvas.current && !sigCanvas.current.isEmpty()) {
        const signatureDataUrl = sigCanvas.current.toDataURL()
        const fileName = `signature-${uuidv4()}.png`
        const file = await (await fetch(signatureDataUrl)).blob()

        const { error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(`signatures/${fileName}`, file, {
            contentType: 'image/png',
        })

        if (uploadError) {
        alert('Failed to upload signature')
        console.error(uploadError)
        setLoading(false)
        return
        }

        const { data: urlData } = supabase.storage
            .from('signatures')
            .getPublicUrl(`signatures/${fileName}`)

        payload.signature = urlData.publicUrl

    }

    // Convert blank strings to null
    Object.keys(payload).forEach((key) => {
        if (payload[key] === '') payload[key] = null
    })

    // Convert arrays
    if (typeof payload.a1_ewc_codes === 'string') {
        payload.a1_ewc_codes = payload.a1_ewc_codes
        ? payload.a1_ewc_codes.split(',').map(s => s.trim())
        : null
    }

    if (typeof payload.b3_role === 'string') {
        payload.b3_role = payload.b3_role
        ? payload.b3_role.split(',').map(s => s.trim())
        : null
    }

    const { error } = await supabase.from('waste_transfer_notes').insert([payload])

    if (!error) {
        onSubmit()
    } else {
        alert('Failed to save WTN')
        console.error(error)
    }

    setLoading(false)
    }


  const fields = [
    { name: 'a1_description', label: 'Description' },
    { name: 'a1_ewc_codes', label: 'EWC Codes (comma-separated)' },
    { name: 'a2_containment', label: 'Containment' },
    { name: 'a3_quantity', label: 'Quantity' },
    { name: 'b1_name', label: 'Producer Name' },
    { name: 'b1_company', label: 'Producer Company' },
    { name: 'b1_address', label: 'Producer Address' },
    { name: 'b2_authority', label: 'Regulatory Authority' },
    { name: 'b3_role', label: 'Carrier Role (comma-separated)' },
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
        <h2 className="text-lg font-bold mb-4">Create Waste Transfer Note</h2>

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
            <img
              src={formData.signature}
              alt="Driver Signature"
              className="border rounded w-64"
            />
          ) : (
            <SignatureCanvas
              ref={sigCanvas}
              penColor="black"
              canvasProps={{ width: 400, height: 150, className: 'border rounded' }}
            />
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-bubbly" disabled={loading} onClick={handleSubmit}>
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button className="btn-bubbly" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
