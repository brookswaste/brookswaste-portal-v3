import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function NewBookingModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    job_type: '',
    customer_name: '',
    company_name: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    county: '',
    post_code: '',
    telephone_number: '',
    mobile_number: '',
    email: '',
    date_of_service: '',
    driver_id: '',
    invoice_address: '',
    date_of_collection: '',
    on_site_contact_number: '',
    delivery_instructions: '',
    portaloo_numbers: '',
    waste_type: '',
    tank_size: '',
    waste_transfer_note_complete: false,
    job_complete: false,
    payment_type: '',
    paid: false,
  })

  const [drivers, setDrivers] = useState([])

  useEffect(() => {
    const fetchDrivers = async () => {
      const { data, error } = await supabase.from('drivers').select('id, name')
      if (!error) setDrivers(data)
    }
    fetchDrivers()
  }, [])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async () => {
    const payload = { ...formData }
    
    // Convert checkboxes to proper booleans
    payload.waste_transfer_note_complete = !!payload.waste_transfer_note_complete
    payload.job_complete = !!payload.job_complete
    payload.paid = !!payload.paid

  // Convert any empty strings to null (important for optional fields like date_of_collection)
  Object.keys(payload).forEach((key) => {
    if (payload[key] === '') {
      payload[key] = null
    }
  })

    console.log('Submitting payload:', payload)

    const { error } = await supabase.from('jobs').insert([payload])

    if (!error) {
        onSave()
        onClose()
    } else {
        console.error('Insert error:', error)
    }
  }


  const fields = [
    { name: 'job_type', label: 'Job Type *', type: 'jobTypeDropdown' },
    { name: 'customer_name', label: 'Customer Name *' },
    { name: 'company_name', label: 'Company Name' },
    { name: 'address_line_1', label: 'Address Line 1 *' },
    { name: 'address_line_2', label: 'Address Line 2' },
    { name: 'city', label: 'City *' },
    { name: 'county', label: 'County' },
    { name: 'post_code', label: 'Postcode *' },
    { name: 'telephone_number', label: 'Telephone' },
    { name: 'mobile_number', label: 'Mobile' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'date_of_service', label: 'Date of Service *', type: 'date' },
    { name: 'driver_id', label: 'Assigned Driver *', type: 'dropdown' },
    { name: 'invoice_address', label: 'Invoice Address' },
    { name: 'date_of_collection', label: 'Date of Collection', type: 'date' },
    { name: 'on_site_contact_number', label: 'On-site Contact' },
    { name: 'delivery_instructions', label: 'Delivery Instructions' },
    { name: 'portaloo_numbers', label: 'Portaloo Numbers' },
    { name: 'portaloo_colour', label: 'Portaloo Colour', type: 'dropdown-colour' },
    { name: 'waste_type', label: 'Waste Type' },
    { name: 'tank_size', label: 'Tank Size' },
    { name: 'payment_type', label: 'Payment Type *', type: 'dropdown-payment' },
    { name: 'waste_transfer_note_complete', label: 'WTN Complete', type: 'checkbox' },
    { name: 'job_complete', label: 'Job Complete', type: 'checkbox' },
    { name: 'paid', label: 'Paid', type: 'checkbox' },
  ]

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="modal-glass bg-white p-6 rounded shadow w-full max-w-4xl">
        <h2 className="text-lg font-bold mb-4">Add New Booking</h2>
        <div className="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-3">
          {fields.map(({ name, label, type }) => (
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
              ) : type === 'jobTypeDropdown' ? (
                <select
                  name={name}
                  value={formData[name] || ''}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select job type</option>
                  <option value="Tanker">Tanker</option>
                  <option value="Blockage">Blockage</option>
                  <option value="CCTV">CCTV</option>
                  <option value="Portaloo">Portaloo</option>
                  <option value="Service">Service</option>
                  <option value="Other">Other</option>
                  <option value="CALL OUT Tanker">CALL OUT Tanker</option>
                  <option value="CALL OUT Blockage">CALL OUT Blockage</option>
                  <option value="CALL OUT CCTV">CALL OUT CCTV</option>
                  <option value="CALL OUT Portaloo">CALL OUT Portaloo</option>
                  <option value="CALL OUT Service">CALL OUT Service</option>
                  <option value="CALL OUT Other">CALL OUT Other</option>
                </select>
              ) : type === 'dropdown-colour' ? (
                <select
                  name={name}
                  value={formData[name] || ''}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select colour</option>
                  <option value="Blue">Blue</option>
                  <option value="Pink">Pink</option>
                  <option value="Green">Green</option>
                </select>
              ) : type === 'dropdown-payment' ? (
                <select
                  name={name}
                  value={formData[name] || ''}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select payment type</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Invoice">Invoice</option>
                  <option value="TBD">TBD</option>
                </select>
              ) : type === 'checkbox' ? (
                <input
                  type="checkbox"
                  name={name}
                  checked={formData[name] || false}
                  onChange={handleChange}
                  className="ml-2"
                />
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
