import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { STAGE_ORDER, STAGE_LABEL, type VendorReportRow } from './loadVendorReport';

function fmt(d: string | null): string {
  if (!d) return '';
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

export function exportVendorPdf(rows: VendorReportRow[], reportType: 'vendor' | 'approval') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text(reportType === 'approval' ? 'Approval Flow Report' : 'Vendor Report', 40, 40);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}  •  ${rows.length} vendor(s)`, 40, 56);

  if (reportType === 'vendor') {
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
      const startY = idx === 0 ? 70 : (doc as any).lastAutoTable.finalY + 24;
      if (startY > 500) doc.addPage();
      doc.setFontSize(10);
      doc.text(`${r.reference_number}  •  ${r.vendor_name}  •  ${r.final_status}`,
        40, idx === 0 ? 70 : (doc as any).lastAutoTable.finalY + 18);
      autoTable(doc, {
        startY: idx === 0 ? 80 : (doc as any).lastAutoTable.finalY + 24,
        head: [['Stage', 'Approver', 'Status', 'Acted At', 'Remarks']],
        body: STAGE_ORDER.map((s) => {
          const i = r.stages[s];
          return [STAGE_LABEL[s], i.approver_name, i.status, fmt(i.acted_at), i.remarks];
        }),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235] },
      });
    });
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  doc.save(`${reportType === 'approval' ? 'approval-flow' : 'vendor'}-report-${stamp}.pdf`);
}
