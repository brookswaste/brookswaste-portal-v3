import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function EditModal({ job, onClose, onSave }) {
  const [formData, setFormData] = useState({ ...job })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : name === 'driver_id'
          ? Number(value)
          : value,
    }))
  }

  const handleSubmit = async () => {
    const { id, ...payload } = formData

    // Ensure booleans are correct
    payload.waste_transfer_note_complete = !!payload.waste_transfer_note_complete
    payload.job_complete = !!payload.job_complete
    payload.paid = !!payload.paid

    // Convert empty strings to null
    Object.keys(payload).forEach((key) => {
      if (payload[key] === '') {
        payload[key] = null
      }
    })

    // Update job by ID
    const { error } = await supabase
      .from('jobs')
      .update(payload)
      .eq('id', id) // ✅ Fixed: pass `id`, not `payload`

    if (!error) {
      onSave()
      onClose()
    } else {
      console.error('Update error:', JSON.stringify(error, null, 2))
      alert('Failed to save changes.')
    }
  }

  const fields = [
    {
      name: 'job_type',
      label: 'Job Type',
      type: 'select',
      options: [
        'Tanker',
        'Blockage',
        'CCTV',
        'Portaloo',
        'Service',
        'Other',
        'CALL OUT Tanker',
        'CALL OUT Blockage',
        'CALL OUT CCTV',
        'CALL OUT Portaloo',
        'CALL OUT Service',
        'CALL OUT Other',
      ],
    },
    { name: 'customer_name', label: 'Customer Name' },
    { name: 'company_name', label: 'Company Name' },
    { name: 'address_line_1', label: 'Address Line 1' },
    { name: 'address_line_2', label: 'Address Line 2' },
    { name: 'city', label: 'City' },
    { name: 'county', label: 'County' },
    { name: 'post_code', label: 'Postcode' },
    { name: 'telephone_number', label: 'Telephone' },
    { name: 'mobile_number', label: 'Mobile' },
    { name: 'date_of_service', label: 'Date of Service', type: 'date' },
    { name: 'invoice_address', label: 'Invoice Address' },
    { name: 'date_of_collection', label: 'Date of Collection', type: 'date' },
    { name: 'on_site_contact_number', label: 'On-site Contact' },
    { name: 'delivery_instructions', label: 'Delivery Instructions' },
    { name: 'portaloo_numbers', label: 'Portaloo Numbers' },
    { name: 'portaloo_colour', label: 'Portaloo Colour', type: 'select', options: ['Blue', 'Pink', 'Green'] },
    { name: 'waste_type', label: 'Waste Type' },
    { name: 'tank_size', label: 'Tank Size' },
    { name: 'waste_transfer_note_complete', label: 'WTN Complete', type: 'checkbox' },
    { name: 'job_complete', label: 'Job Complete', type: 'checkbox' },
    {
      name: 'payment_type',
      label: 'Payment Type',
      type: 'select',
      options: ['Cash', 'Card', 'Invoice', 'TBD'],
    },
    { name: 'paid', label: 'Paid', type: 'checkbox' },
  ]

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="modal-glass bg-white p-6 rounded shadow w-full max-w-4xl">
        <h2 className="text-lg font-bold mb-4">Edit Job</h2>
        <div className="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-3">
          {fields.map(({ name, label, type }) => (
            <div key={name}>
              <label className="text-xs text-gray-600">{label}</label>
              {type === 'date' ? (
                <input
                  type="date"
                  name={name}
                  value={formData[name]?.split('T')[0] || ''}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
              ) : type === 'checkbox' ? (
                <input
                  type="checkbox"
                  name={name}
                  checked={formData[name] || false}
                  onChange={handleChange}
                  className="ml-2"
                />
              ) : type === 'select' ? (
                <select
                  name={name}
                  value={formData[name] || ''}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select</option>
                  {fields.find(f => f.name === name)?.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
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
          <button className="btn-bubbly" onClick={handleSubmit}>
            Save
          </button>
          <button className="btn-bubbly" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
