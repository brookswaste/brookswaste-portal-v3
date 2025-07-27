// BookingsModals.jsx
import React, { useState, useEffect } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { supabase } from '../supabaseClient'

export function EditJobModal({ job, onClose, onSave }) {
  const [formData, setFormData] = useState({ ...job })
  const [drivers, setDrivers] = useState([])

  useEffect(() => {
    const fetchDrivers = async () => {
      const { data, error } = await supabase.from('drivers').select('id, name')
      if (!error) setDrivers(data)
    }
    fetchDrivers()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async () => {
    const payload = { ...formData }
    let result

    if (payload.id) {
      // Update existing job
      result = await supabase
        .from('jobs')
        .update(payload)
        .eq('id', payload.id)
    } else {
      // Insert new job, remove id to allow auto-increment
      delete payload.id
      result = await supabase
        .from('jobs')
        .insert([payload])
    }

    if (!result.error) {
      onSave()
      onClose()
    } else {
      console.error('Submit error:', result.error)
    }
  }

  const jobFields = [
    { name: 'job_type', label: 'Job Type *' },
    { name: 'customer_name', label: 'Customer Name *' },
    { name: 'company_name', label: 'Company Name' },
    { name: 'address_line_1', label: 'Address Line 1 *' },
    { name: 'address_line_2', label: 'Address Line 2' },
    { name: 'city', label: 'City *' },
    { name: 'county', label: 'County' },
    { name: 'post_code', label: 'Postcode *' },
    { name: 'telephone_number', label: 'Telephone' },
    { name: 'mobile_number', label: 'Mobile' },
    { name: 'date_of_service', label: 'Date of Service *', type: 'date' },
    { name: 'driver_id', label: 'Assigned Driver *', type: 'dropdown' },
    { name: 'invoice_address', label: 'Invoice Address' },
    { name: 'date_of_collection', label: 'Date of Collection', type: 'date' },
    { name: 'on_site_contact_number', label: 'On-site Contact' },
    { name: 'delivery_instructions', label: 'Delivery Instructions' },
    { name: 'portaloo_numbers', label: 'Portaloo Numbers' },
    { name: 'waste_type', label: 'Waste Type' },
    { name: 'tank_size', label: 'Tank Size' },
    { name: 'waste_transfer_note_complete', label: 'WTN Complete (true/false)' },
    { name: 'job_complete', label: 'Job Complete (true/false)' },
    { name: 'payment_type', label: 'Payment Type *' },
    { name: 'paid', label: 'Paid (true/false)' },
  ]

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="modal-glass bg-white p-6 rounded shadow w-full max-w-4xl">
        <h2 className="text-lg font-bold mb-4">{formData.id ? 'Edit Job' : 'Add New Job'}</h2>
        <div className="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-3">
          {jobFields.map(({ name, label, type }) => (
            <div key={name}>
              <label className="text-xs text-gray-600">{label}</label>
              {type === 'date' ? (
                <input
                  type="date"
                  name={name}
                  value={formData[name] || ''}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
              ) : type === 'dropdown' ? (
                <select
                  name={name}
                  value={formData[name] || ''}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select a driver</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name={name}
                  value={formData[name] || ''}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-bubbly" onClick={handleSubmit}>Save</button>
          <button className="btn-bubbly" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export function ViewEditArchivedJobModal({ job, onClose }) {
  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="modal-glass bg-white p-6 rounded shadow w-[90%] max-w-2xl">
        <h2 className="text-lg font-bold mb-4">Archived Job Details</h2>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(job).map(([key, val]) => (
            <div key={key}>
              <label className="text-xs text-gray-500">{key}</label>
              <input 
                className="w-full p-2 border rounded"
                defaultValue={val}
                disabled={key === 'id'}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-4">
          <button className="btn-bubbly">Download WTN</button>
          <button className="btn-bubbly" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export function CreateWTNModal({ jobId, onClose, onSubmit }) {
  const [signatureData, setSignatureData] = useState(null)
  let sigPadRef = null

  const handleSave = () => {
    if (!sigPadRef.isEmpty()) {
      const signature = sigPadRef.getTrimmedCanvas().toDataURL('image/png')
      onSubmit(signature)
      onClose()
    }
  }

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="modal-glass bg-white p-6 rounded shadow max-w-2xl w-full">
        <h2 className="text-xl font-bold mb-4">Create Waste Transfer Note</h2>
        <div className="space-y-3 text-sm">
          <form className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Waste Carrier Name" className="p-2 border rounded" />
            <input type="text" placeholder="Vehicle Reg" className="p-2 border rounded" />
            <input type="text" placeholder="Waste Description" className="p-2 border rounded" />
            <input type="text" placeholder="Address" className="p-2 border rounded" />
            <input type="date" className="p-2 border rounded" />
          </form>
          <div className="border p-2 bg-white rounded">
            <p className="mb-2 font-medium text-black">Driver Signature (draw below):</p>
            <SignatureCanvas
              ref={(ref) => (sigPadRef = ref)}
              penColor="black"
              canvasProps={{ width: 500, height: 150, className: 'border rounded bg-white' }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-bubbly" onClick={handleSave}>Submit WTN</button>
          <button className="btn-bubbly" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export function ViewWTNPDFModal({ pdfUrl, onClose }) {
  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="modal-glass bg-white p-6 rounded shadow max-w-3xl w-full">
        <h2 className="text-xl font-bold mb-3">Waste Transfer Note Preview</h2>
        <iframe src={pdfUrl} className="w-full h-[600px] border rounded bg-white" />
        <div className="flex justify-end mt-4">
          <a href={pdfUrl} download className="btn-bubbly mr-2">Download PDF</a>
          <button className="btn-bubbly" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
