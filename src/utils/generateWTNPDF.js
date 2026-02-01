import jsPDF from "jspdf";

/**
 * Branded pink, two-column WTN PDF generator
 *
 * @param {Object} wtn  - waste_transfer_notes row
 * @param {Object|null} job - optional job row for fallback values
 */
export default async function generateWTNPDF(wtn, job = null) {
  // --- Layout variants to try (all 1-page if possible) ---
  const LAYOUTS = [
    {
      name: "normal",
      headerSize: 14,
      labelSize: 8.5,
      valueSize: 10,
      sectionGap: 12,
      lineGap: 3,
      sigHeight: 18,
    },
    {
      name: "compact",
      headerSize: 13,
      labelSize: 8,
      valueSize: 9.2,
      sectionGap: 10,
      lineGap: 2.5,
      sigHeight: 16,
    },
    {
      name: "ultra",
      headerSize: 12,
      labelSize: 7.6,
      valueSize: 8.6,
      sectionGap: 9,
      lineGap: 2.2,
      sigHeight: 14,
    },
  ];

  const LIGHT_PINK = "#fde2e7";
  const TEXT = "#111111";
  const MUTED = "#6b7280";
  const RULE = "#e5e7eb";

  // Fetch image URL -> dataURL (for logo + signatures)
  const loadDataUrl = async (url) => {
    if (!url) return null;
    try {
      const res = await fetch(url, { cache: "no-store" });
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

  const dateOfService =
    wtn.date_of_service ||
    job?.date_of_service ||
    job?.archived_date_of_service ||
    "-";

  const displaySIC =
    wtn.sic_code === "00000 - Other: _______"
      ? wtn.sic_other || ""
      : wtn.sic_code || "";

  const displayEWC = wtn.ewc || "";

  const driverName = wtn.driver_name || "-";
  const customerName = wtn.customer_name || "-";

  // --- Single render attempt for a given layout ---
  const renderOnce = async (layout) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Page metrics
    const MARGIN = 12;
    const PAGE_W = 210;
    const PAGE_H = 297;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    const BOTTOM_SAFE = 287;
    const COL_GAP = 6;
    const COL_W = (CONTENT_W - COL_GAP) / 2;

    let y = MARGIN;

    const line = (x1, y1, x2, y2) => {
      doc.setDrawColor(RULE);
      doc.setLineWidth(0.2);
      doc.line(x1, y1, x2, y2);
    };

    const wouldOverflow = (needed = 20) => y + needed > BOTTOM_SAFE;

    const sectionHeader = (title) => {
      y += 6;
      doc.setFillColor(LIGHT_PINK);
      doc.setTextColor("#000000");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(layout.headerSize - 2);
      doc.rect(MARGIN, y, CONTENT_W, 8, "F");
      doc.text(title, MARGIN + 3, y + 5.8);
      y += layout.sectionGap;
      doc.setTextColor(TEXT);
    };

    const fitHeight = (label, value, width) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(layout.labelSize);
      const lab = doc.splitTextToSize((label || "").toUpperCase(), width);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(layout.valueSize);
      const val = doc.splitTextToSize(value || "-", width);
      const labelBlock =
        lab.length * Math.max(layout.lineGap + 1.2, 3.8);
      const valueBlock =
        val.length * Math.max(layout.lineGap + 1.6, 4.6);
      return labelBlock + valueBlock + 2.5;
    };

    const drawField = (x, yStart, label, value, width) => {
      doc.setTextColor(MUTED);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(layout.labelSize);

      const lab = doc.splitTextToSize(
        (label || "").toUpperCase(),
        width
      );
      let yCursor = yStart;
      lab.forEach((l, i) =>
        doc.text(l, x, yCursor + 3.2 + i * (layout.lineGap + 1))
      );
      yCursor += lab.length * (layout.lineGap + 1) + 1;

      doc.setTextColor(TEXT);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(layout.valueSize);
      const val = doc.splitTextToSize(value || "-", width);
      val.forEach((v, i) =>
        doc.text(v, x, yCursor + 3.8 + i * (layout.lineGap + 1.4))
      );
      yCursor += val.length * (layout.lineGap + 1.4) + 1.5;

      line(x, yCursor + 1.1, x + width, yCursor + 1.1);
      return yCursor + 2.2;
    };

    // --- Header + Logo ---
    const logoDataUrl = await loadDataUrl("/images/brooks-logo.png");
    if (logoDataUrl) {
      doc.addImage(
        logoDataUrl,
        "PNG",
        PAGE_W - MARGIN - 36,
        MARGIN - 6,
        36,
        0
      );
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(layout.headerSize);
    doc.setTextColor(TEXT);
    doc.text("Brooks Waste – Sewage Specialist", MARGIN, y + 6);

    doc.setFontSize(layout.headerSize - 1);
    doc.text("CONTROLLED WASTE TRANSFER NOTE", PAGE_W - MARGIN, y + 6, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.text(
      "Kendale The Drive, Rayleigh Essex, SS6 8XQ",
      MARGIN,
      y + 11
    );
    doc.text(
      "01268776126 · info@brookswaste.co.uk · www.brookswaste.co.uk",
      MARGIN,
      y + 15.5
    );
    doc.text(
      "Waste Carriers Reg #: CBDU167551",
      MARGIN,
      y + 20
    );
    y += 24;
    
    // --- Job Details ---
    sectionHeader("Job Details");

    let leftY = y;
    let rightY = y;
    const X1 = MARGIN;
    const X2 = MARGIN + COL_W + COL_GAP;

    // Combine Time In / Time Out into a single row to save space
    const timeInOut =
      (wtn.time_in || wtn.time_out)
        ? `${wtn.time_in || "-"} – ${wtn.time_out || "-"}`
        : "-";

    const jobLeft = [
      ["Date of Service", dateOfService],
      ["Customer Job Reference", wtn.customer_job_reference],
      ["Job Description", wtn.job_description],
      ["Time In / Time Out", timeInOut],
    ];

    const jobRight = [
      ["Waste Containment", wtn.waste_containment],
      ["Vehicle Registration", wtn.vehicle_registration],
      ["Driver Name", driverName],
    ];


    for (const [label, value] of jobLeft) {
      const h = fitHeight(label, value || "-", COL_W);
      if (wouldOverflow(h)) return { doc, overflow: true };
      leftY = drawField(X1, leftY, label, value || "-", COL_W);
    }
    for (const [label, value] of jobRight) {
      const h = fitHeight(label, value || "-", COL_W);
      if (wouldOverflow(h)) return { doc, overflow: true };
      rightY = drawField(X2, rightY, label, value || "-", COL_W);
    }
    y = Math.max(leftY, rightY);

    // --- Client Details ---
    sectionHeader("Client Details");
    leftY = y;
    rightY = y;

    const clientLeft = [
      ["Client Name", wtn.client_name],
      ["Customer Name", customerName],
    ];

    const clientRight = [
      ["Site Address", wtn.site_address],
      ["Client Email", wtn.client_email],
      ["Client Telephone", wtn.client_telephone],
      // If you ever want to show client_address too:
      // ["Client Address", wtn.client_address],
    ];

    for (const [label, value] of clientLeft) {
      const h = fitHeight(label, value || "-", COL_W);
      if (wouldOverflow(h)) return { doc, overflow: true };
      leftY = drawField(X1, leftY, label, value || "-", COL_W);
    }
    for (const [label, value] of clientRight) {
      const h = fitHeight(label, value || "-", COL_W);
      if (wouldOverflow(h)) return { doc, overflow: true };
      rightY = drawField(X2, rightY, label, value || "-", COL_W);
    }
    y = Math.max(leftY, rightY);

    // --- Waste Details ---
    sectionHeader("Waste Details");
    leftY = y;
    rightY = y;

    const wasteLeft = [
      ["SIC Code", displaySIC],
      ["EWC Code", displayEWC],
      ["Waste Description", wtn.waste_description],
    ];
    const wasteRight = [
      ["Amount Removed", wtn.amount_removed],
      ["Disposal Address", wtn.disposal_address],
    ];

    for (const [label, value] of wasteLeft) {
      const h = fitHeight(label, value || "-", COL_W);
      if (wouldOverflow(h)) return { doc, overflow: true };
      leftY = drawField(X1, leftY, label, value || "-", COL_W);
    }
    for (const [label, value] of wasteRight) {
      const h = fitHeight(label, value || "-", COL_W);
      if (wouldOverflow(h)) return { doc, overflow: true };
      rightY = drawField(X2, rightY, label, value || "-", COL_W);
    }
    y = Math.max(leftY, rightY);

    // --- Signatures ---
    sectionHeader("Signatures");

    const SIG_W = (CONTENT_W - COL_GAP) / 2;
    const SIG_H = layout.sigHeight;
    if (wouldOverflow(SIG_H + 20)) return { doc, overflow: true };

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);

    // 🔹 Driver & Customer names ABOVE signatures
    doc.text(`Driver: ${driverName}`, MARGIN, y + 4);
    doc.text(
      `Customer: ${customerName}`,
      MARGIN + SIG_W + COL_GAP,
      y + 4
    );

    doc.setDrawColor(RULE);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, y + 6, SIG_W, SIG_H);
    doc.rect(MARGIN + SIG_W + COL_GAP, y + 6, SIG_W, SIG_H);

    // Load signatures as data URLs if present
    const opSigData = await loadDataUrl(wtn.operative_signature);
    if (opSigData) {
      doc.addImage(
        opSigData,
        "PNG",
        MARGIN + 2,
        y + 8,
        SIG_W - 4,
        SIG_H - 4
      );
    }

    const custSigData = await loadDataUrl(wtn.customer_signature);
    if (custSigData) {
      doc.addImage(
        custSigData,
        "PNG",
        MARGIN + SIG_W + COL_GAP + 2,
        y + 8,
        SIG_W - 4,
        SIG_H - 4
      );
    }

    y += SIG_H + 8;

    // --- Additional Comments ---
    sectionHeader("Additional Comments");

    const commentsText = (wtn.additional_comments || "").trim() || "-";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(layout.valueSize);
    doc.setTextColor(TEXT);

    const COMMENT_LINE_H = Math.max(layout.lineGap + 1.6, 4.6);
    const commentLines = doc.splitTextToSize(
      commentsText,
      CONTENT_W - 6
    );
    const boxHeight = Math.max(
      layout.sigHeight,
      commentLines.length * COMMENT_LINE_H + 8
    );

    if (wouldOverflow(boxHeight + 6)) return { doc, overflow: true };

    doc.setDrawColor(RULE);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, y, CONTENT_W, boxHeight);

    // Draw each line manually so spacing is consistent and never looks "justified"
    const textX = MARGIN + 3;
    let textY = y + 6;

    doc.setFont("helvetica", "normal"); // comments should be normal weight (optional)
    doc.setFontSize(layout.valueSize);
    doc.setTextColor(TEXT);

    for (const line of commentLines) {
      // safety: don't write past the box
      if (textY > y + boxHeight - 3) break;
      doc.text(line, textX, textY, { align: "left" });
      textY += COMMENT_LINE_H;
    }

    y += boxHeight + 6;


    // --- Footer / Terms ---
    doc.setTextColor(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.1);

    const terms = doc.splitTextToSize(
      "You are signing to say you have read the above details and that they are correct and the operative has completed the job to a satisfactory standard. " +
        "Brooks Waste Ltd takes no responsibility for any damage done to your property where access is not suitable for a tanker. " +
        "Please see our full terms and conditions on brookswaste.co.uk - Registered in England 06747484 Registered Office: 4 Chester Court, Chester Hall Lane Basildon, Essex SS14 3WR",
      CONTENT_W
    );

    if (wouldOverflow(terms.length * 3.8 + 10))
      return { doc, overflow: true };
    doc.text(terms, MARGIN, PAGE_H - MARGIN - 8);

    return { doc, overflow: false };
  };

  // --- Try layouts until one fits on 1 page ---
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

  const safeRef =
    (wtn.customer_job_reference || `Job_${wtn.job_id || "WTN"}`)
      .toString()
      .replace(/[^\w\-]+/g, "_");

  finalDoc.save(`WTN_${safeRef}.pdf`);
}
