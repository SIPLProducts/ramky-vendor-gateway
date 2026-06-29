import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { STAGE_ORDER, STAGE_LABEL, type VendorReportRow } from './loadVendorReport';

function fmt(d: string | null | undefined): string {
  if (!d) return '';
  try { return new Date(d).toLocaleString(); } catch { return String(d); }
}

function statusLabel(s: string): string {
  if (s === 'skipped') return 'Skipped';
  if (s === 'pending') return 'Pending';
  if (s === 'approved') return 'Approved';
  if (s === 'rejected') return 'Rejected';
  if (s === 'returned') return 'Returned';
  return s;
}

export function exportVendorPdf(rows: VendorReportRow[], reportType: 'vendor' | 'approval' | 'both') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text(reportType === 'approval' ? 'Approval Flow Report' : 'Vendor Report', 40, 40);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}  •  ${rows.length} vendor(s)`, 40, 56);

  const isSingle = rows.length === 1 && !!rows[0].details;

  if (isSingle) {
    const r = rows[0];
    const d = r.details ?? {};

    autoTable(doc, {
      startY: 70,
      head: [['Field', 'Value']],
      body: [
        ['Reference #', r.reference_number],
        ['Vendor Name', r.vendor_name],
        ['Vendor Type', r.vendor_type],
        ['Invited Email', r.invited_email],
        ['Invited At', fmt(r.invited_at)],
        ['Submitted At', fmt(r.submitted_at)],
        ['On Behalf', r.on_behalf ? 'Yes' : 'No'],
        ['Current Stage', r.current_stage],
        ['Final Status', r.final_status],
      ],
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    const detailEntries = Object.entries(d)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
    if (detailEntries.length) {
      doc.addPage();
      doc.setFontSize(12);
      doc.text('Vendor Details', 40, 40);
      autoTable(doc, {
        startY: 56,
        head: [['Field', 'Value']],
        body: detailEntries,
        styles: { fontSize: 7, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235] },
      });
    }

    if (r.documents && r.documents.length) {
      doc.addPage();
      doc.setFontSize(12);
      doc.text('Documents', 40, 40);
      autoTable(doc, {
        startY: 56,
        head: [['Type', 'File Name', 'Uploaded At']],
        body: r.documents.map((dd) => [dd.document_type, dd.file_name, fmt(dd.uploaded_at)]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235] },
      });
    }

    if (r.validations && r.validations.length) {
      doc.addPage();
      doc.setFontSize(12);
      doc.text('Validations', 40, 40);
      autoTable(doc, {
        startY: 56,
        head: [['Validation', 'Status', 'Verified At']],
        body: r.validations.map((vv) => [vv.validation_type, vv.status, fmt(vv.verified_at)]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235] },
      });
    }

    doc.addPage();
    doc.setFontSize(12);
    doc.text('Approval Flow', 40, 40);
    autoTable(doc, {
      startY: 56,
      head: [['Stage', 'Approver', 'Status', 'Acted At', 'Remarks']],
      body: STAGE_ORDER.map((s) => {
        const i = r.stages[s];
        const skipped = i.status === 'skipped';
        return [
          STAGE_LABEL[s],
          skipped ? '—' : i.approver_name,
          statusLabel(i.status),
          skipped ? '—' : fmt(i.acted_at),
          skipped ? '—' : (i.remarks || '—'),
        ];
      }),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235] },
    });
  } else if (reportType === 'vendor') {
    autoTable(doc, {
      startY: 70,
      head: [['Ref #', 'Vendor', 'Type', 'Invited', 'Submitted', 'Current', 'Status']],
      body: rows.map((r) => [
        r.reference_number, r.vendor_name, r.vendor_type,
        fmt(r.invited_at), fmt(r.submitted_at), r.current_stage, r.final_status,
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235] },
    });
  } else {
    rows.forEach((r, idx) => {
      if (idx > 0) doc.addPage();
      doc.setFontSize(10);
      doc.text(`${r.reference_number}  •  ${r.vendor_name}  •  ${r.final_status}`, 40, 40);
      autoTable(doc, {
        startY: 56,
        head: [['Stage', 'Approver', 'Status', 'Acted At', 'Remarks']],
        body: STAGE_ORDER.map((s) => {
          const i = r.stages[s];
          const skipped = i.status === 'skipped';
          return [
            STAGE_LABEL[s],
            skipped ? '—' : i.approver_name,
            statusLabel(i.status),
            skipped ? '—' : fmt(i.acted_at),
            skipped ? '—' : i.remarks,
          ];
        }),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235] },
      });
    });
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  doc.save(`${reportType === 'approval' ? 'approval-flow' : 'vendor'}-report-${stamp}.pdf`);
}
