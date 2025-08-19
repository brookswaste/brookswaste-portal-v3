import React, { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { supabase } from '../supabaseClient'
import { v4 as uuidv4 } from 'uuid'
import { useEffect } from 'react' // Make sure this is at the top

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


export default function NewWTN({ jobId, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    job_id: jobId,
    client_name: '',
    client_telephone: '',
    client_email: '',
    client_address: '',
    site_address: '',
    vehicle_registration: '',
    waste_containment: '',
    sic_code: '',
    ewc: '',
    waste_description: '',
    amount_removed: '',
    disposal_address: '',
    job_description: '',
    portaloo_dropoff_date: '',
    portaloo_collection_date: '',
    time_in: '',
    time_out: '',
    operative_signature: '',
    driver_name: '',
    customer_signature: '',
    customer_name: '',
  })

  const [loading, setLoading] = useState(false)
  const operativeSigCanvas = useRef()
  const customerSigCanvas = useRef()

  useEffect(() => {
    const fetchJobAndDriver = async () => {
      setLoading(true)

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (jobError || !job) {
        console.error('Error fetching job:', jobError)
        setLoading(false)
        return
      }

      let driverName = ''
      if (job.driver_id) {
        const { data: driver, error: driverError } = await supabase
          .from('drivers')
          .select('name')
          .eq('id', job.driver_id)
          .single()

        if (!driverError && driver) {
          driverName = driver.name
        }
      }

      const {
        customer_name,
        mobile_number,
        company_name,
        address_line_1,
        address_line_2,
        city,
        county,
        post_code,
        job_type,
      } = job

      const fullAddress = [
        company_name,
        address_line_1,
        address_line_2,
        city,
        county,
        post_code,
      ]
        .filter(Boolean)
        .join(', ')

      setFormData((prev) => ({
        ...prev,
        client_name: customer_name || '',
        client_telephone: mobile_number || '',
        client_address: fullAddress || '',
        job_description: job_type || '',
        driver_name: driverName || '',
      }))

      setLoading(false)
    }

    fetchJobAndDriver()
  }, [jobId])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const uploadSignature = async (canvasRef, label) => {
    if (!canvasRef.current || canvasRef.current.isEmpty()) return null
    const signatureDataUrl = canvasRef.current.toDataURL()
    const fileName = `signature-${label}-${uuidv4()}.png`
    const file = await (await fetch(signatureDataUrl)).blob()

    const { error: uploadError } = await supabase.storage
      .from('signatures')
      .upload(`signatures/${fileName}`, file, { contentType: 'image/png' })

    if (uploadError) {
      throw new Error(`Failed to upload ${label} signature`)
    }

    const { data: urlData } = supabase.storage
      .from('signatures')
      .getPublicUrl(`signatures/${fileName}`)

    return urlData.publicUrl
  }

  const handleSubmit = async () => {
    setLoading(true)
    const payload = { ...formData }
    if (!payload.ewc) {
      alert('Please select an EWC code.');
      setLoading(false);
      return;
    }


    // Fetch user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      alert('Unable to fetch user.')
      console.error(userError)
      setLoading(false)
      return
    }

    payload.created_by = user.id

    try {
      // Upload signatures if not already uploaded
      if (!payload.operative_signature)
        payload.operative_signature = await uploadSignature(
          operativeSigCanvas,
          'operative'
        )

      if (!payload.customer_signature)
        payload.customer_signature = await uploadSignature(
          customerSigCanvas,
          'customer'
        )
    } catch (err) {
      alert(err.message)
      console.error(err)
      setLoading(false)
      return
    }

    // Convert blanks to null
    Object.keys(payload).forEach((key) => {
      if (payload[key] === '') payload[key] = null
    })

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
    { name: 'client_name', label: 'Client Name' },
    { name: 'client_telephone', label: 'Client Telephone' },
    { name: 'client_email', label: 'Client Email' },
    { name: 'client_address', label: 'Client Address' },
    { name: 'site_address', label: 'Site Address' },
    { name: 'vehicle_registration', label: 'Vehicle Registration' },
    { name: 'waste_containment', label: 'How is the waste contained?' },
    { name: 'sic_code', label: 'SIC Code' },
    { name: 'ewc', label: 'EWC' },
    { name: 'waste_description', label: 'Waste Being Transferred' },
    { name: 'amount_removed', label: 'Amount of Waste Removed' },
    { name: 'disposal_address', label: 'Disposal Address' },
    { name: 'job_description', label: 'Job Description' },
    { name: 'portaloo_dropoff_date', label: 'Portaloo Dropoff Date', type: 'date' },
    { name: 'portaloo_collection_date', label: 'Portaloo Collection Date', type: 'date' },
    { name: 'time_in', label: 'Time In', type: 'time' },
    { name: 'time_out', label: 'Time Out', type: 'time' },
    { name: 'driver_name', label: 'Driver Name' },
    { name: 'customer_name', label: 'Customer Name' },
  ]

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="modal-glass bg-white p-6 rounded shadow w-full max-w-5xl">
        <h2 className="text-lg font-bold mb-4">Create Waste Transfer Note</h2>

        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-3">
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
          <h3 className="text-sm font-semibold mb-1">Operative Signature</h3>
          {formData.operative_signature ? (
            <img
              src={formData.operative_signature}
              alt="Operative Signature"
              className="border rounded w-64"
            />
          ) : (
            <SignatureCanvas
              ref={operativeSigCanvas}
              penColor="black"
              canvasProps={{ width: 400, height: 150, className: 'border rounded' }}
            />
          )}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-1">Customer Signature</h3>
          {formData.customer_signature ? (
            <img
              src={formData.customer_signature}
              alt="Customer Signature"
              className="border rounded w-64"
            />
          ) : (
            <SignatureCanvas
              ref={customerSigCanvas}
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
