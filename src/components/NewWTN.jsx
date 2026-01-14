import React, { useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { supabase } from '../supabaseClient'
import { v4 as uuidv4 } from 'uuid'

const EWC_OPTIONS = [
  '20 03 04 - Septic Tank Sludge',
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
  '20 03 06 - Waste from Sewage Cleaning',
  '20 03 99 - Municipal Waste Not Otherwise Specified',
  'Other - ______________________________________',
];

const VEHICLE_REGISTRATION_OPTIONS = [
  'WX07 TVD',
  'CE55 PET',
  'HX12 NNT',
  'PN09 JPY',
  'PO06 EAN',
  'PO05 TOM',
  'GD07 CZN',
  'HX14 WDL',
  'YJ57 FMM',
  'PO05 DNO',
  'BX64 BWL',
  'RK66 PYV',
  'RK66 PZN',
  'TO11 LTS',
  'OU12 ZJV',
  'GH16 MVT',
  'LE71 LOO',
  'WF61 WVU',
  'EF15 ZBY',
  'Other – ___________________________'
];

// ▼ SIC: categories are shown as disabled "headers"
const SIC_OPTIONS = [
  'Construction & Building',
  '41201 – Construction of commercial buildings',
  '41202 – Construction of domestic buildings',
  '42110 – Construction of roads and motorways',
  '42990 – Construction of other civil engineering projects n.e.c.',
  '43999 – Other specialised construction activities n.e.c.',

  'Hospitality, Leisure, Events',
  '55100 – Hotels and similar accommodation',
  '55209 – Other holiday and short-stay accommodation',
  '56101 – Licensed restaurants',
  '56210 – Event catering activities',

  'Public Services / Institutions',
  '85200 – Primary education',
  '86101 – Hospital activities',
  '87300 – Residential care activities for the elderly and disabled',
  '84110 – General public administration',

  'Agriculture / Rural',
  '01500 – Mixed farming',
  '01610 – Support activities for crop production',
  '01629 – Support activities for animal production',

  'Industrial / Commercial',
  '37000 – Sewerage',
  '38110 – Collection of non-hazardous waste',
  '39000 – Remediation activities and other waste management services',
  '81210 – General cleaning of buildings',
  '81229 – Other building and industrial cleaning activities',

  '00000 - Other: _______',
]

// ▼ Disposal site options
const DISPOSAL_ADDRESS_OPTIONS = [
  'N/A',
  'Anglian Water - NR17 1AW, Attleborough WRC, Long Street, Attlebrough, Norfolk',
  'Anglian Water - SS13 1DB, Basildon WRC, Courtauld Road, Basildon, Essex',
  'Anglian Water - MK41 9RZ, Bedford WRC, Bakers Lane, Bedford, Bedfordshire',
  'Anglian Water - NN9 5RE, Broadholme WRC, Wellingborough Rpad, Irthlingborough, Wellingborough',
  'Anglian Water - NR30 5TE, Caister WRC, Yarmouth Road, Caister On Sea, Great Yarmouth',
  'Anglian Water - CB4 0DL, Cambridge WRC, Cowley Road, Cambridge',
  'Anglian Water - LN4 1EF, Canwick WRC, Washborough Road, Canwick, Lincoln',
  'Anglian Water - LU4 9UQ, Chalton WRC, Luton Road, Chalton, Luton',
  'Anglian Water - NN17 5UE, Cordy WRC, Weldon Road, Corby',
  'Anglian Water - MK15 9PA, Cotton Valley WRC, V11 Tongwell Street, Pineham, Milton Keynes',
  'Anglian Water - IP22 4JG, Diss WRC, Victoria Road, Diss, Norfolk',
  'Anglian Water - IP11 3HH, Felixstowe WRC, The Docks, Felixstowe, Suffolk',
  'Anglian Water - PE1 5QR, Flag Fen WRC, Third Drove, Fen Gate, Peterborough',
  'Anglian Water - IP28 6JH, Fornham WRC, The Street, Fornham All Saints, Bury St Edmunds',
  'Anglian Water - NN3 9BX, Great Billing WRC, Crow Lane, Little Billing, Northampton',
  'Anglian Water - CO12 5HD, Harwich & Dovercourt WRD, Ray Lane, Ramsey, Harwich',
  'Anglian Water - CB9 7UR, Haverhill WRC, Chalkstone Way, Haverhill, Suffolk',
  'Anglian Water - PE25 1JJ, Ingoldmells WRC, Bolton\'s Lane, Ingoldmells, Skegness',
  'Anglian Water - PE34 4BZ, Kings Lynn WRC, Clockcase Road, Clenchwarton, King\'s Lynn',
  'Anglian Water - NR32 1UZ, Lowestoft WRC, Gas Works Road, Lowestoft, Suffolk',
  'Anglian Water - NG32 2HX, Marston WRC, Sand Lane, Grantham, Kesteven',
  'Anglian Water - DN31 2SY, Pyewipe WRC, Moody lane, Grimsby, Lincolnshire',
  'Anglian Water - CB10 1BT, Saffron Walden WRC, New Pond Lane, Saffron Walden, Uttlesford',
  'Anglian Water - PE11 2BB, Spalding WRC, West Marsh Road, Spalding, Holland',
  'Anglian Water - NR12 9LQ, Stalham WRC, Wayford Road, Stalham, Norwich',
  'Anglian Water - CO10 1XR, Sudbury WRC, Brundon Lane, Sudbury, Babergh',
  'Anglian Water - RM18 7NR, Tilbury WRC, Fort Road, Tilbury, Essex',
  'Anglian Water - NR14 8TZ, Whitlingham WRC, Whitlingham Lane, Trowse, Norwich',
  'Anglian Water - NR18 9EL, Wymondham WRC, Chapel Lane, Wymondham, Norfolk',

  'Thames Water - GU34 2QH, Alton STW, Waterbrook Road, off Mill Lane, Alton, Hampshire',
  'Thames Water - HP19 8RT, Aylesbury STW, Rabans Lane, Aylesbury, Buckinghamshire',
  'Thames Water - OX16 4RZ, Banbury STW, Thorpe Mead, Thorpe Industrial Estate, Banbury, Oxfordshire',
  'Thames Water - RG24 8LL, Basingstokes STW, Whitmarsh Lane, Chineham, Basingstoke, Hampshire',
  'Thames Water - IG11 0AD, Beckton STW, Jenkins Lane, Barking, Essex',
  'Thames Water - OX25 2NY, Bicester STW, Oxford Road, Bicester, Oxfordshire',
  'Thames Water - CM22 7QL, Bishops Stortford STW, Jenkins Lane, Great Hallingbury, Bishops Stortford, Herts',
  'Thames Water - GU15 3YL, Camberley STW, Riverside Way, Camberley, Surrey',
  'Thames Water - KT16 0AR, Chertsey STW, Lyne Lane, Lyne, Chertsey, Surrey',
  'Thames Water - GL7 6DA, Cirencester STW, Tudmoor, Kemble Road, South Cerney, Cirencester, Gloucestershire',
  'Thames Water - RH10 3NW, Crawley STW, Radford Rd, Tinsley Green, Crawley, West Sussex',
  'Thames Water - SE2 9AQ, Crossness STW, Bazalgette Way, Abbey Wood, London',
  'Thames Water - DA1 5PP, Dartford, Long Reach STW, Marsh Street, Dartford, Kent',
  'Thames Water - N9 0BD, Deephams STW, Ardra Road, Enfield, London',
  'Thames Water - OX11 7HJ, Didcot STW, Foxhall Lane, Basil Hill Road, Didcot, Oxon',
  'Thames Water - LU1 3TS, East Hyde STW, West Hyde Road, East Hyde, Luton',
  'Thames Water - GU9 9ND, Farnham STW, Monkton Lane, Farnham, Surrey',
  'Thames Water - GU1 1RU, Guildford STW, Slyfield Industrial Estate, Moorfield Road,, Guildford, Surrey',
  'Thames Water - SL7 3RT, Little Marlow STW, Muschallik Road, off Marlow Road (A4155),, Little Marlow, Marlow, Bucks',
  'Thames Water - WD3 9SQ, Maple Lodge STW, Denham Way, Maple Cross, Rickmansworth, Hertfordshire',
  'Thames Water - TW7 7LR, Mogden STW, Mogden Lane, Isleworth, London',
  'Thames Water - RG19 3TH, Newbury STW, Lower Way, Thatcham, Berkshire',
  'Thames Water - OX4 4XU, Oxford STW, Grenoble Road, Sandford-on-Thames, Oxford, Oxfordshire',
  'Thames Water - RG2 0RP, Reading STW, Island Road, Reading, Berkshire',
  'Thames Water - SG12 8JY, Rye Meads STW, Rye Road, Stanstead Abbotts, Ware,, Hertfordshire',
  'Thames Water - TN14 6EP, Sevenoaks District Council STW, Dunbrik Depot, 2 Main Road, Sundridge, Sevenoaks, Kent',
  'Thames Water - SL1 9EB, Slough STW, Wood Lane, Slough, Berkshire',
  'Thames Water - SN2 2DJ, Swindon STW, Barnfield Road, Rodbourne, Swindon',
  'Thames Water - OX12 0DL, Wantage STW, Cow Lane, Bradfield Grove Farm, Grove, Near Wantage, Oxfordshire',
  'Thames Water - RG10 8DJ, Wargrave STW, Twyford Road, Wargrave, Berkshire',
  'Thames Water - OX28 5JH, Witney STW, Ducklington Lane, Witney, Oxfordshire',
  'Thames Water - GU22 8JQ, Woking STW, Carters Lane, Old Woking, Surrey',

  'Southern Water - ME13 8HX, Abbyfields STW, Abbey Fields, Faversham, Kent',
  'Southern Water - TN21 9QB, Ashford STW, Canterbury Road, Bybrook, Ashford, Kent',
  'Southern Water - ME20 7DA, Aylesford STW, Bull Lane, Aylesford, Kent',
  'Southern Water - PO9 1JW, Budds Farm STW, Southmoor Lane, Havent, Hampshire',
  'Southern Water - CT2 0AA, Canterbury STW, Sturry Road, Canterbury, Kent',
  'Southern Water - PO20 7PE, Chichester STW, Appledram Lane, Chichester, West Sussex',
  'Southern Water - SO50 6RQ, Chickenhall STW, Chickenhall Lane, Eastleigh, Hampshire',
  'Southern Water - TN17 3NW, Cranbrook STW, Bakers Cross, Cranbrook, Kent',
  'Southern Water - CT3 1LU, Dambridge STW, Staple Road, Wingahm, Kent',
  'Southern Water - TN8 6LW, Edenbridge STW, Skinners Lane, Edenbridge, Kent',
  'Southern Water - BN18 0HY, Ford STW, Ford Areodrome, Ford Road, Arundel, Sussex',
  'Southern Water - SP11 7HP, Fullerton STW, Stockbridge Road, Fullerton, Hampshire',
  'Southern Water - RH17 5AL, Goddards Green STW, Cuckfield Road, Ansty, Goddards Green, Sussex',
  'Southern Water - BN27 1ER, Hailsham North STW, Battle Road, Hailsham, Sussex',
  'Southern Water - ME6 5JX, Ham Hill STW, Brook Lane, Snodland, Kent',
  'Southern Water - RH12 3UB, Horsham STW, A24 By Pass, Horsham, Sussex',
  'Southern Water - PO22 9PL, Lidsey STW, Shripney Road, Lidsey, Sussex',
  'Southern Water - RH7 6BZ, Lingfield STW, Crowshurst Road, Lingfield, Hampshire',
  'Southern Water - SO21 1JS, Morestead STW, Morestead Road, Winchester, Hampshire',
  'Southern Water - TN28 8LU, New Romney STW, Station Approach, New Romney, Kent',
  'Southern Water - BN10 8LN, Peacehaven STW, Lower Hodden Farm, Hoyle Road, Brighton & Hove',
  'Southern Water - PO14 2LJ, Peel Common STW, Newgate Lane, Stubbington, Peel Common, Hampshire',
  'Southern Water - SO41 8QZ, Pennington STW, Milford Road, Pennington, Hampshire',
  'Southern Water - PO36 8DE, Sandown STW, East Yar Road, Sandown, Isle of Wright',
  'Southern Water - RH17 7NP, Scaynes Hill STW, Sloop Lane, Scaynes Hill, Sussex',
  'Southern Water - PO20 7NE, Sidlesham STW, Selsey Road, Sidlesham, Sussex',
  'Southern Water - ME10 2QE, Sittingbourne STW, Church Marshes, Sittingbourne, Kent',
  'Southern Water - SO40 4UD, Slowhill Copse STW, Bury Road, Marchwood, Hampshire',
  'Southern Water - GU29 0BX, South Ambersham STW, Selham Road, Midhurst, South Ambersham, Hampshire',
  'Southern Water - TN9 1XX, Tonbridge STW, Vale Road, Tonbridge, Kent',
  'Southern Water - TN22 5DL, Uckfield STW, Bridge Farm Road, Uckfield, Sussex',
  'Southern Water - CT12 5FH, Weatherlees Hill STW, Jutes Lane, Weatherlees Hill, Kent',
  'Southern Water - ME2 4UZ, Whitewall Creek STW, Upnor Road, Whitewall Creek, Kent',

  'Commercial Waste & Contaminated Waste - SS6 8XH, Brooks Waste, Ethel Road, Rayleigh, Essex',
  'Commercial Waste & Contaminated Waste - SS13 1DB, Alpheus, Courtauld Road, Basildon, Essex',
  'Commercial Waste & Contaminated Waste - DA1 3QY, FM Conway, Rochester Way, Dartford, Kent',
  'Commercial Waste & Contaminated Waste - NR14 6NZ, M.Gaze & Co, Crossways Farm, Thurlton, Norwich',
  'Commercial Waste & Contaminated Waste - CB24 8PS, Malary, Malary House, Brookfield Business Centre, Cottenham, Cambridge',

  'Other - ______________________________________',
];

export default function NewWTN({ jobId, onClose, onSubmit, singleColumn = false }) {
  const [formData, setFormData] = useState({
    job_id: jobId,
    customer_job_reference: '',
    date_of_service: '',
    client_name: '',
    client_telephone: '',
    client_email: '',
    client_address: '',     // kept in state (will be left blank), not shown in UI
    site_address: '',
    vehicle_registration: '',
    vehicle_registration_other: '',
    waste_containment: 'Tanker',
    sic_code: '',
    sic_other: '',
    ewc: '',
    ewc_other: '',
    waste_description: '',
    amount_removed: '',
    disposal_address: '',
    job_description: '',
    time_in: '',
    time_out: '',
    operative_signature: '',
    driver_name: '',
    customer_signature: '',
    customer_name: '',
    additional_comments: '',
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
        date_of_service,
      } = job

      const { customer_job_reference } = job;

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

      // ✅ CHANGE: prefill Site Address only; do NOT set client_address
      setFormData((prev) => ({
        ...prev,
        date_of_service: date_of_service || '',
        customer_job_reference: customer_job_reference || '',
        client_name: customer_name || '',
        client_telephone: mobile_number || '',
        client_address: '',              // keep empty; not shown
        site_address: fullAddress || '', // <-- put the combined address here
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
    // 🔹 Required field validation BEFORE saving
    const missing = []

    const requiredText = [
      ["client_name", "Client Name"],
      ["site_address", "Site Address"],
      ["vehicle_registration", "Vehicle Registration"],
      ["sic_code", "SIC Code"],
      ["ewc", "EWC"],
      ["waste_description", "Waste Description"],
      ["amount_removed", "Amount Removed"],
      ["disposal_address", "Disposal Address"],
      ["job_description", "Job Description"],
      ["time_in", "Time In"],
      ["time_out", "Time Out"],
      ["driver_name", "Driver Name"],
      ["customer_name", "Customer Name"],
    ]

    requiredText.forEach(([key, label]) => {
      if (!formData[key] || String(formData[key]).trim() === "") {
        missing.push(label)
      }
    })

    // 🔹 Signatures: either already saved in formData OR drawn on canvas
    const operativeMissing =
      !formData.operative_signature &&
      (!operativeSigCanvas.current || operativeSigCanvas.current.isEmpty())

    const customerMissing =
      !formData.customer_signature &&
      (!customerSigCanvas.current || customerSigCanvas.current.isEmpty())

    if (operativeMissing) missing.push("Driver Signature")
    if (customerMissing) missing.push("Customer Signature")

    if (missing.length > 0) {
      alert(
        "Please complete all required fields before saving this WTN:\n\n" +
          missing.map((f) => `• ${f}`).join("\n")
      )
      return // ⛔ Stop here, don't save
    }
    setLoading(true)
    const payload = { ...formData }

    // If EWC is "Other", save custom text into ewc; do not send helper field
    if (
      payload.ewc === 'Other - ______________________________________' &&
      payload.ewc_other
    ) {
      payload.ewc = payload.ewc_other.trim()
    }
    delete payload.ewc_other
    // If "Other" was selected, use the custom value
    if (
      payload.vehicle_registration === 'Other – ___________________________' &&
      payload.vehicle_registration_other
    ) {
      payload.vehicle_registration = payload.vehicle_registration_other.trim()
    }
    // Do not send helper field to Supabase
    delete payload.vehicle_registration_other
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

    payload.sic_code = formData.sic_code;
    payload.sic_other = formData.sic_other;

    // If EWC is "Other", save custom text into ewc; do not send helper field
    if (
      formData.ewc === 'Other - ______________________________________' &&
      formData.ewc_other
    ) {
      payload.ewc = String(formData.ewc_other).trim()
    }
    delete payload.ewc_other

    const { error } = await supabase.from('waste_transfer_notes').insert([payload])

    if (!error) {
      onSubmit()
    } else {
      alert('Failed to save WTN')
      console.error(error)
    }

    setLoading(false)
  }

  // ✅ Client Address removed from the fields UI; only Site Address remains
  const fields = [
    { name: 'date_of_service', label: 'Date of Service', type: 'date' },
    { name: 'client_name', label: 'Client Name' },
    { name: 'client_telephone', label: 'Client Telephone' },
    { name: 'client_email', label: 'Client Email' },
    // { name: 'client_address', label: 'Client Address' }, // removed from UI
    { name: 'site_address', label: 'Site Address' },
    { name: 'vehicle_registration', label: 'Vehicle Registration' },
    { name: 'waste_containment', label: 'How is the waste contained?' },
    { name: 'sic_code', label: 'SIC Code' },
    { name: 'ewc', label: 'EWC' },
    { name: 'waste_description', label: 'Waste Being Transferred' },
    { name: 'amount_removed', label: 'Amount of Waste Removed' },
    { name: 'disposal_address', label: 'Disposal Address' },
    { name: 'job_description', label: 'Job Description' },
    { name: 'additional_comments', label: 'Additional Comments', type: 'textarea' },
    { name: 'time_in', label: 'Time In', type: 'time' },
    { name: 'time_out', label: 'Time Out', type: 'time' },
    { name: 'driver_name', label: 'Driver Name' },
    { name: 'customer_name', label: 'Customer Name' },
  ]

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="modal-glass bg-white p-6 rounded shadow w-full max-w-5xl">
        <h2 className="text-lg font-bold mb-4">Create Waste Transfer Note</h2>

        <div
          className={`grid ${singleColumn ? 'grid-cols-1' : 'grid-cols-2'} gap-4 max-h-[60vh] overflow-y-auto pr-3`}
        >
          {fields.map(({ name, label, type }) => (
            <div key={name} className={name === 'additional_comments' && !singleColumn ? 'col-span-2' : ''}>
              <label className="text-xs text-gray-600">{label}</label>

              { name === 'ewc' ? (
                <>
                  <select
                    name="ewc"
                    value={formData.ewc || ''}
                    onChange={handleChange}
                    required
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select EWC code…</option>
                    {EWC_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>

                  {formData.ewc === 'Other - ______________________________________' && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-600">Custom EWC Code/Description</label>
                      <input
                        type="text"
                        name="ewc_other"
                        value={formData.ewc_other || ''}
                        onChange={(e) => setFormData((prev) => ({ ...prev, ewc_other: e.target.value }))}
                        placeholder="Enter custom EWC"
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  )}
                </>
              ) : name === 'sic_code' ? (
                <React.Fragment>
                  <select
                    name="sic_code"
                    value={formData.sic_code || ''}
                    onChange={(e) => {
                      const value = e.target.value
                      setFormData((prev) => ({
                        ...prev,
                        sic_code: value,
                        sic_other: value === '00000 - Other: _______' ? '' : null,
                      }))
                    }}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select SIC code…</option>
                    {SIC_OPTIONS.map((opt) => {
                      const isHeader = !/\d/.test(opt)
                      return (
                        <option key={opt} value={isHeader ? '' : opt} disabled={isHeader}>
                          {opt}
                        </option>
                      )
                    })}
                  </select>

                  {formData.sic_code === '00000 - Other: _______' && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-600">Custom SIC description</label>
                      <input
                        type="text"
                        name="sic_other"
                        value={formData.sic_other || ''}
                        onChange={(e) => setFormData((prev) => ({ ...prev, sic_other: e.target.value }))}
                        placeholder="Type your custom SIC code or description"
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  )}
                </React.Fragment>
              ) : name === 'disposal_address' ? (
                <select
                  name="disposal_address"
                  value={formData.disposal_address || ''}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select disposal site…</option>
                  {DISPOSAL_ADDRESS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : name === 'vehicle_registration' ? (
                <>
                  <select
                    name="vehicle_registration"
                    value={formData.vehicle_registration || ''}
                    onChange={handleChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select vehicle…</option>
                    {VEHICLE_REGISTRATION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>

                  {formData.vehicle_registration === 'Other – ___________________________' && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-600">Custom Vehicle Registration</label>
                      <input
                        type="text"
                        name="vehicle_registration_other"
                        value={formData.vehicle_registration_other || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, vehicle_registration_other: e.target.value }))
                        }
                        placeholder="Enter custom vehicle registration"
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  )}
                </>
              ) : type === 'textarea' ? (
                <textarea
                  name={name}
                  value={formData[name] || ''}
                  onChange={handleChange}
                  className="w-full p-2 border rounded min-h-[110px]"
                  placeholder="Add any extra notes for this WTN…"
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
          <button className="btn btn-primary btn-md" disabled={loading} onClick={handleSubmit}>
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button className="btn btn-primary btn-md" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
