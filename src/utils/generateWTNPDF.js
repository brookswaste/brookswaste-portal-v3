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
      name: "compact",
      headerSize: 12,
      labelSize: 7.5,
      valueSize: 8.5,
      sectionGap: 9,
      lineGap: 1.8,
      sigHeight: 14,
    },
    {
      name: "extraCompact",
      headerSize: 11,
      labelSize: 7,
      valueSize: 8,
      sectionGap: 9,
      lineGap: 1.4,
      sigHeight: 12,
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

    doc.setCharSpace(0);

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

    const sectionHeader = (title, topGap = 6) => {
      y += topGap;
      doc.setFillColor(LIGHT_PINK);
      doc.setTextColor("#000000");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(layout.headerSize - 2);
      doc.rect(MARGIN, y, CONTENT_W, 6, "F");
      doc.text(title, MARGIN + 3, y + 4.3);
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
      yCursor += val.length * (layout.lineGap + 1.4) + 0.5;

      line(x, yCursor + 0.8, x + width, yCursor + 0.8);
      return yCursor + 1.3;
    };

    // Convert messy textarea input to clean plain text (fixes spaced letters like "C a l l")
    const toPlainText = (input) => {
      if (input === null || input === undefined) return "";

      let s = String(input);

      // Unicode normalize
      if (typeof s.normalize === "function") s = s.normalize("NFKC");

      // Remove invisible characters (zero-width etc.)
      s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");

      // Normalize strange spaces
      s = s.replace(/\u00A0/g, " ").replace(/\u202F/g, " ").replace(/\u2007/g, " ");

      // Normalize newlines
      s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      // Collapse multiple spaces
      s = s.replace(/\t/g, " ").replace(/[ ]{2,}/g, " ");

      // Fix spaced-letter runs line-by-line: "C a l l  o u t" -> "Call out"
      s = s
        .split("\n")
        .map((line) => {
          const tokens = line.split(" ").filter(Boolean);
          const out = [];
          let i = 0;

          while (i < tokens.length) {
            if (tokens[i].length === 1) {
              let j = i;
              while (j < tokens.length && tokens[j].length === 1) j++;

              const runLen = j - i;
              if (runLen >= 3) {
                out.push(tokens.slice(i, j).join(""));
                i = j;
                continue;
              }
            }

            out.push(tokens[i]);
            i++;
          }

          return out.join(" ").replace(/[ ]{2,}/g, " ").trim();
        })
        .join("\n");

      return s.trim();
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
    sectionHeader("Job Details", 2);

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
    sectionHeader("Client Details", 2);
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
    sectionHeader("Waste Details", 2);
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

    // --- Waste hierarchy statement ---
    const hierarchyStatement =
      "I confirm that I have fulfilled my duty to apply the waste hierarchy as required by the Waste (England and Wales) Regulations 2012";

    doc.setFont("helvetica", "normal");
    doc.setFontSize(layout.labelSize);
    doc.setTextColor(TEXT);

    const hierarchyLines = doc.splitTextToSize(
      hierarchyStatement,
      CONTENT_W
    );
    const hierarchyLineHeight = 3.8;
    const hierarchyHeight =
      hierarchyLines.length * hierarchyLineHeight;

    if (wouldOverflow(2 + hierarchyHeight + 2)) {
      return { doc, overflow: true };
    }

    y += 2;
    hierarchyLines.forEach((textLine, index) => {
      doc.text(
        textLine,
        MARGIN,
        y + 3 + index * hierarchyLineHeight
      );
    });
    y += hierarchyHeight;

    // Reduce the default gap before the signatures heading.
    y -= 4;

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

    // --- Footer: reserve space on every page ---
    const FOOTER_FONT = 7.1;
    const FOOTER_LINE_HEIGHT = 3.2;
    const PAGE_BOTTOM = PAGE_H - MARGIN;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(FOOTER_FONT);

    const terms = doc.splitTextToSize(
        "Please see our full terms and conditions on brookswaste.co.uk - Registered in England 06747484 Registered Office: 4 Chester Court, Chester Hall Lane Basildon, Essex SS14 3WR",
      CONTENT_W
    );

    const footerFirstBaseline =
      PAGE_BOTTOM - 2 - (terms.length - 1) * FOOTER_LINE_HEIGHT;

    const commentsBottom = footerFirstBaseline - 7;

    const drawFooter = () => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(FOOTER_FONT);
      doc.setTextColor(MUTED);

      terms.forEach((textLine, index) => {
        doc.text(
          textLine,
          MARGIN,
          footerFirstBaseline + index * FOOTER_LINE_HEIGHT
        );
      });
    };

    // Keep signatures and preceding details clear of the footer.
    // If necessary, retry using the next compact layout.
    if (y > commentsBottom) {
      return { doc, overflow: true };
    }

    // --- Additional Comments: continue across pages ---
    const COMMENTS_FONT = 8;
    const COMMENT_LINE_HEIGHT = 3.4;
    const BOX_PADDING_TOP = 6;
    const BOX_PADDING_BOTTOM = 4;
    const HEADER_HEIGHT = 6 + layout.sectionGap;

    // Preserve the full comment text, including line breaks.
    const commentsText =
      String(wtn.additional_comments ?? "")
        .replace(/\r\n?/g, "\n")
        .trim() || "-";

    doc.setFont("helvetica", "normal");
    doc.setFontSize(COMMENTS_FONT);

    const commentLines = doc.splitTextToSize(
      commentsText,
      CONTENT_W - 6
    );

    const startCommentsPage = () => {
      drawFooter();
      doc.addPage();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(TEXT);
      doc.text("Brooks Waste – WTN", MARGIN, MARGIN + 5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      const reference = String(
        wtn.customer_job_reference || wtn.job_id || wtn.id || "-"
      );

      const referenceLines = doc.splitTextToSize(
        `Reference: ${reference}`,
        CONTENT_W
      );

      referenceLines.forEach((textLine, index) => {
        doc.text(textLine, MARGIN, MARGIN + 11 + index * 4);
      });

      y = MARGIN + 15 + (referenceLines.length - 1) * 4;
    };

    let lineIndex = 0;

    while (lineIndex < commentLines.length) {
      // Leave room for the heading, padding, and one text line.
      const minimumHeight =
        HEADER_HEIGHT +
        BOX_PADDING_TOP +
        COMMENT_LINE_HEIGHT +
        BOX_PADDING_BOTTOM;

      if (y + minimumHeight > commentsBottom) {
        startCommentsPage();
      }

      sectionHeader(
        lineIndex === 0
          ? "Additional Comments"
          : "Additional Comments (continued)"
      );

      const availableTextHeight =
        commentsBottom - y - BOX_PADDING_TOP - BOX_PADDING_BOTTOM;

      const linesThatFit = Math.floor(
        availableTextHeight / COMMENT_LINE_HEIGHT
      );

      if (linesThatFit < 1) {
        // Protect against unusually long reference/header content.
        return { doc, overflow: true };
      }

      const pageLines = commentLines.slice(
        lineIndex,
        lineIndex + linesThatFit
      );

      const boxHeight =
        BOX_PADDING_TOP +
        pageLines.length * COMMENT_LINE_HEIGHT +
        BOX_PADDING_BOTTOM;

      doc.setDrawColor(RULE);
      doc.setLineWidth(0.2);
      doc.rect(MARGIN, y, CONTENT_W, boxHeight);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(COMMENTS_FONT);
      doc.setTextColor(TEXT);
      doc.setCharSpace(0);

      pageLines.forEach((textLine, index) => {
        doc.text(
          textLine,
          MARGIN + 3,
          y + BOX_PADDING_TOP + index * COMMENT_LINE_HEIGHT
        );
      });

      lineIndex += pageLines.length;
      y += boxHeight;

      if (lineIndex < commentLines.length) {
        startCommentsPage();
      }
    }

    drawFooter();

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
