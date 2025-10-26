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

// ▼ SIC: show category headers but make them unselectable
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
    setLoading(true);

    if (!formData?.id) {
      alert('WTN ID missing — cannot update');
      setLoading(false);
      return;
    }

    // Validate EWC pick
    if (!formData.ewc || !EWC_OPTIONS.includes(formData.ewc)) {
      alert('Please select a valid EWC code.');
      setLoading(false);
      return;
    }

    // Only columns that actually exist in waste_transfer_notes
    const ALLOWED_KEYS = [
      'job_id',
      'created_by',
      'client_name',
      'client_telephone',
      'client_email',
      'client_address',
      'site_address',
      'vehicle_registration',
      'waste_containment',
      'sic_code',
      'sic_other',
      'ewc',
      'waste_description',
      'carrier_registration_number',
      'amount_removed',
      'disposal_address',
      'job_description',
      'portaloo_dropoff_date',
      'portaloo_collection_date',
      'operative_signature',
      'driver_name',
      'customer_signature',
      'customer_name',
      'time_in',
      'time_out',
      'date_of_service',
      'customer_job_reference',
      'additional_comments',
    ];

    // Build a clean payload with only valid columns
    const payload = {};
    for (const key of ALLOWED_KEYS) {
      if (key in formData) payload[key] = formData[key];
    }

    // Remove undefined; convert "" -> null
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
      else if (payload[k] === '') payload[k] = null;
    });

    // Preserve creator if present
    if (!payload.created_by && formData.created_by) {
      payload.created_by = formData.created_by;
    }

    console.log('Updating with keys:', Object.keys(payload));

    const { error } = await supabase
      .from('waste_transfer_notes')
      .update(payload)
      .eq('id', formData.id);

    if (error) {
      console.error('Update WTN error:', error);
      alert('Failed to update WTN.');
    } else {
      onSubmit();
    }

    setLoading(false);
  };

  const handleDownloadPDF = async () => {
    // Try multiple layouts to fit on 1 page
    const LAYOUTS = [
      { name: 'normal', headerSize: 14, labelSize: 8.5, valueSize: 10, sectionGap: 12, lineGap: 3, sigHeight: 30 },
      { name: 'compact', headerSize: 13, labelSize: 8,   valueSize: 9.2, sectionGap: 10, lineGap: 2.5, sigHeight: 26 },
      { name: 'ultra',   headerSize: 12, labelSize: 7.6, valueSize: 8.6, sectionGap: 9,  lineGap: 2.2, sigHeight: 22 },
    ];

    const LIGHT_PINK = '#fde2e7';
    const TEXT = '#111111';
    const MUTED = '#6b7280';
    const RULE = '#e5e7eb';

    // Synchronous helper to load an image as dataURL (optional)
    const loadDataUrl = async (url) => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return null;
        const blob = await res.blob();
        return await new Promise((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    };

    const renderOnce = async (layout) => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Page metrics
      const MARGIN = 12;
      const PAGE_W = 210;
      const PAGE_H = 297;
      const CONTENT_W = PAGE_W - MARGIN * 2;
      const BOTTOM_SAFE = 287;
      const COL_GAP = 6;
      const COL_W = (CONTENT_W - COL_GAP) / 2;

      let y = MARGIN;

      // Helpers
      const line = (x1, y1, x2, y2) => {
        doc.setDrawColor(RULE);
        doc.setLineWidth(0.2);
        doc.line(x1, y1, x2, y2);
      };
      const wouldOverflow = (needed = 20) => (y + needed > BOTTOM_SAFE);

      const sectionHeader = (title) => {
        y += 6;
        doc.setFillColor(LIGHT_PINK);
        doc.setTextColor('#000000');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(layout.headerSize - 2);
        doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
        doc.text(title, MARGIN + 3, y + 5.8);
        y += layout.sectionGap;
        doc.setTextColor(TEXT);
      };

      const fitHeight = (label, value, width) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(layout.labelSize);
        const lab = doc.splitTextToSize((label || '').toUpperCase(), width);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(layout.valueSize);
        const val = doc.splitTextToSize(value || '-', width);
        const labelBlock = lab.length * Math.max(layout.lineGap + 1.2, 3.8);
        const valueBlock = val.length * Math.max(layout.lineGap + 1.6, 4.6);
        return labelBlock + valueBlock + 2.5;
      };

      const drawField = (x, yStart, label, value, width) => {
        doc.setTextColor(MUTED);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(layout.labelSize);
        const lab = doc.splitTextToSize((label || '').toUpperCase(), width);
        let yCursor = yStart;
        lab.forEach((l, i) => doc.text(l, x, yCursor + 3.2 + i * (layout.lineGap + 1)));
        yCursor += lab.length * (layout.lineGap + 1) + 1;

        doc.setTextColor(TEXT);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(layout.valueSize);
        const val = doc.splitTextToSize(value || '-', width);
        val.forEach((v, i) => doc.text(v, x, yCursor + 3.8 + i * (layout.lineGap + 1.4)));
        yCursor += val.length * (layout.lineGap + 1.4) + 1.5;

        line(x, yCursor + 1.1, x + width, yCursor + 1.1);
        return yCursor + 2.2;
      };

      // === Header (always draw text first) ===
      // Optional logo (dataURL). If it fails, we still have the header text.
      const logoDataUrl = await loadDataUrl('/images/brooks-logo.png');
      if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', PAGE_W - MARGIN - 36, MARGIN, 36, 0);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(layout.headerSize);
      doc.setTextColor(TEXT);
      doc.text('Brooks Waste – Sewage Specialist', MARGIN, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(MUTED);
      doc.text('Kendale The Drive, Rayleigh Essex, SS6 8XQ', MARGIN, y + 11);
      doc.text('01268776126 · info@brookswaste.co.uk · www.brookswaste.co.uk', MARGIN, y + 15.5);
      doc.text('Waste Carriers Reg #: CBDU167551', MARGIN, y + 20);
      y += 24;

      // Display values
      const displaySIC =
        formData.sic_code === '00000 - Other: _______' ? (formData.sic_other || '') : (formData.sic_code || '');
      const displayEWC =
        formData.ewc === 'Other - ______________________________________'
          ? (formData.ewc_other || 'Other (unspecified)')
          : (formData.ewc || '');

      // === Job Details (2 cols) ===
      sectionHeader('Job Details');

      let leftY = y;
      let rightY = y;
      const X1 = MARGIN;
      const X2 = MARGIN + COL_W + COL_GAP;

      const jobLeft = [
        ['Date of Service', formData.date_of_service],
        ['Customer Job Reference', formData.customer_job_reference],
        ['Job Description', formData.job_description],
      ];
      const jobRight = [
        ['Waste Containment', formData.waste_containment],
        ['Vehicle Registration', formData.vehicle_registration],
        ['Driver Name', formData.driver_name],
      ];

      for (const [label, value] of jobLeft) {
        const h = fitHeight(label, value || '-', COL_W);
        if (wouldOverflow(h)) return { doc, overflow: true };
        leftY = drawField(X1, leftY, label, value || '-', COL_W);
      }
      for (const [label, value] of jobRight) {
        const h = fitHeight(label, value || '-', COL_W);
        if (wouldOverflow(h)) return { doc, overflow: true };
        rightY = drawField(X2, rightY, label, value || '-', COL_W);
      }
      y = Math.max(leftY, rightY);

      // === Client Details (2 cols) ===
      sectionHeader('Client Details');
      leftY = y; rightY = y;

      const clientLeft = [
        ['Client Name', formData.client_name],
        ['Client Email', formData.client_email],
        ['Client Telephone', formData.client_telephone],
      ];
      const clientRight = [
        ['Client Address', formData.client_address],
        ['Site Address', formData.site_address],
      ];

      for (const [label, value] of clientLeft) {
        const h = fitHeight(label, value || '-', COL_W);
        if (wouldOverflow(h)) return { doc, overflow: true };
        leftY = drawField(X1, leftY, label, value || '-', COL_W);
      }
      for (const [label, value] of clientRight) {
        const h = fitHeight(label, value || '-', COL_W);
        if (wouldOverflow(h)) return { doc, overflow: true };
        rightY = drawField(X2, rightY, label, value || '-', COL_W);
      }
      y = Math.max(leftY, rightY);

      // === Waste Details (2 cols) ===
      sectionHeader('Waste Details');
      leftY = y; rightY = y;

      const wasteLeft = [
        ['SIC Code', displaySIC],
        ['EWC Code', displayEWC],
        ['Waste Description', formData.waste_description],
      ];
      const wasteRight = [
        ['Amount Removed', formData.amount_removed],
        ['Disposal Address', formData.disposal_address],
      ];

      for (const [label, value] of wasteLeft) {
        const h = fitHeight(label, value || '-', COL_W);
        if (wouldOverflow(h)) return { doc, overflow: true };
        leftY = drawField(X1, leftY, label, value || '-', COL_W);
      }
      for (const [label, value] of wasteRight) {
        const h = fitHeight(label, value || '-', COL_W);
        if (wouldOverflow(h)) return { doc, overflow: true };
        rightY = drawField(X2, rightY, label, value || '-', COL_W);
      }
      y = Math.max(leftY, rightY);

      // === Signatures ===
      sectionHeader('Signatures');

      const SIG_W = (CONTENT_W - COL_GAP) / 2;
      const SIG_H = layout.sigHeight;
      if (wouldOverflow(SIG_H + 20)) return { doc, overflow: true };

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(MUTED);
      doc.text('Driver Signature', MARGIN, y + 4);
      doc.text('Customer Signature', MARGIN + SIG_W + COL_GAP, y + 4);

      doc.setDrawColor(RULE);
      doc.setLineWidth(0.2);
      doc.rect(MARGIN, y + 6, SIG_W, SIG_H);
      doc.rect(MARGIN + SIG_W + COL_GAP, y + 6, SIG_W, SIG_H);

      if (formData.operative_signature) {
        doc.addImage(formData.operative_signature, 'PNG', MARGIN + 2, y + 8, SIG_W - 4, SIG_H - 4);
      }
      if (formData.customer_signature) {
        doc.addImage(formData.customer_signature, 'PNG', MARGIN + SIG_W + COL_GAP + 2, y + 8, SIG_W - 4, SIG_H - 4);
      }

      y += SIG_H + 12;

      // === Additional Comments ===
      sectionHeader('Additional Comments');

      const commentsText = (formData.additional_comments || '').trim() || '-';

      // Split to fit page width
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(layout.valueSize);
      doc.setTextColor(TEXT);

      const commentLines = doc.splitTextToSize(commentsText, CONTENT_W - 6);

      // Compute a nice box height (min height + padding)
      const COMMENT_LINE_H = Math.max(layout.lineGap + 1.6, 4.6);
      const boxHeight = Math.max(
        layout.sigHeight,                      // give it some presence
        commentLines.length * COMMENT_LINE_H + 8 // text + padding
      );

      // If this would overflow the page, signal overflow so the next layout tries
      if (wouldOverflow(boxHeight + 6)) return { doc, overflow: true };

      // Draw box and text
      doc.setDrawColor(RULE);
      doc.setLineWidth(0.2);
      doc.rect(MARGIN, y, CONTENT_W, boxHeight);

      doc.text(commentLines, MARGIN + 3, y + 6);
      y += boxHeight + 6;

      // Terms / footer
      doc.setTextColor(MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.1);
      const terms = doc.splitTextToSize(
        'You are signing to say you have read the above details and that they are correct and the operative has completed the job to a satisfactory standard. Brooks Waste Ltd takes no responsibility for any damage done to your property where access is not suitable for a tanker. Please see our full terms and conditions on brookswaste.co.uk - Registered in England 06747484 Registered Office: 4 Chester Court, Chester Hall Lane Basildon, Essex SS14 3WR',
        CONTENT_W
      );
      if (wouldOverflow(terms.length * 3.8 + 10)) return { doc, overflow: true };
      doc.text(terms, MARGIN, PAGE_H - MARGIN - 8);

      return { doc, overflow: false };
    };
    
    // Try to fit on one page by stepping through layouts
    let finalDoc = null;
    for (const layout of LAYOUTS) {
      const { doc, overflow } = await renderOnce(layout);
      if (!overflow) {
        finalDoc = doc;
        break;
      }
    }
    if (!finalDoc) {
      const { doc } = await renderOnce(LAYOUTS[LAYOUTS.length - 1]);
      finalDoc = doc;
    }

    const safeRef = (formData.customer_job_reference || 'WTN').replace(/[^\w\-]+/g, '_');
    finalDoc.save(`WTN_${safeRef}.pdf`);
  };

  if (!formData) return null

  const fields = [
    { name: 'date_of_service', label: 'Date of Service', type: 'date' },
    { name: 'customer_job_reference', label: 'Customer Job Reference' },
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
    { name: 'time_in', label: 'Time In', type: 'time' },
    { name: 'time_out', label: 'Time Out', type: 'time' },
    { name: 'driver_name', label: 'Driver Name' },
    { name: 'customer_name', label: 'Customer Name' },
    { name: 'additional_comments', label: 'Additional Comments', type: 'textarea' },
  ]

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="modal-glass bg-white p-6 rounded shadow w-full max-w-5xl">
        <h2 className="text-lg font-bold mb-4">Edit Waste Transfer Note</h2>

        <div className="grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto pr-3">
          {fields.map(({ name, label, type }) => (
            <div key={name} className={name === 'additional_comments' ? 'col-span-2' : ''}>
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
                  {EWC_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : name === 'disposal_address' ? (
                <select
                  name="disposal_address"
                  value={formData.disposal_address || ''}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select disposal site…</option>
                  {DISPOSAL_ADDRESS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : name === 'sic_code' ? (
                <>
                  <select
                    name="sic_code"
                    value={formData.sic_code || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({
                        ...formData,
                        sic_code: value,
                        sic_other: value === '00000 - Other: _______' ? (formData.sic_other || '') : null,
                      });
                    }}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select SIC code…</option>
                    {SIC_OPTIONS.map((opt) => {
                      const isHeader = !/\d/.test(opt);
                      return (
                        <option key={opt} value={isHeader ? '' : opt} disabled={isHeader}>
                          {opt}
                        </option>
                      );
                    })}
                  </select>

                  {formData.sic_code === '00000 - Other: _______' && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-600">Custom SIC description</label>
                      <input
                        type="text"
                        name="sic_other"
                        value={formData.sic_other || ''}
                        onChange={(e) => setFormData({ ...formData, sic_other: e.target.value })}
                        placeholder="Type your custom SIC code or description"
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
                  placeholder={name === 'additional_comments' ? 'Add any extra notes for this WTN…' : ''}
                />
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
          <button className="btn btn-primary btn-md" onClick={handleDownloadPDF}>
            Download PDF
          </button>
          <button className="btn btn-primary btn-md" disabled={loading} onClick={handleUpdate}>
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button className="btn btn-primary btn-md" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
