import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateTime } from '@/lib/dateFormat';

type Rows = Record<string, any>[];
export function exportUserAuditPdf(opts: { userName: string; summary: Record<string, any>; all: Rows }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 64, 175); doc.rect(0, 0, W, 56, 'F');
  doc.setFillColor(59, 130, 246); doc.rect(W / 2, 0, W / 2, 56, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.text('User Audit Report', 32, 34);
  doc.setFontSize(9); doc.text(`${opts.userName}  |  Generated ${formatDateTime(new Date())}`, W - 32, 34, { align: 'right' });
  doc.setTextColor(30, 30, 30);
  autoTable(doc, {
    startY: 72, theme: 'grid', styles: { fontSize: 8, cellPadding: 3 },
    head: [['Field', 'Value', 'Field', 'Value']],
    headStyles: { fillColor: [30, 64, 175] },
    body: (() => { const e = Object.entries(opts.summary); const out: any[] = [];
      for (let i = 0; i < e.length; i += 2) out.push([e[i][0], String(e[i][1] ?? ''), e[i + 1]?.[0] ?? '', String(e[i + 1]?.[1] ?? '')]); return out; })(),
  });
  const section = (title: string, rows: Rows, color: [number, number, number]) => {
    let y = (doc as any).lastAutoTable.finalY + 20;
    if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = 40; }
    doc.setFontSize(11); doc.setTextColor(...color); doc.text(`${title} (${rows.length})`, 32, y); doc.setTextColor(30, 30, 30);
    if (!rows.length) { autoTable(doc, { startY: y + 6, body: [['No Records Found']], styles: { fontSize: 8 } }); return; }
    const cols = Object.keys(rows[0]);
    autoTable(doc, {
      startY: y + 6, theme: 'striped', styles: { fontSize: 7, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: color }, head: [cols], body: rows.map((r) => cols.map((c) => String(r[c] ?? ''))),
      didParseCell: (d) => {
        if (d.section !== 'body') return;
        const c: Record<string, [number, number, number]> = { Pending: [254, 237, 213], Approved: [220, 252, 231], Rejected: [254, 226, 226], Returned: [254, 249, 195], Invited: [219, 234, 254], 'On Behalf': [224, 231, 255] };
        const f = c[String((rows[d.row.index] as any).Type)]; if (f) d.cell.styles.fillColor = f;
      },
    });
  };
  section('All Records', opts.all, [37, 99, 235]);
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Page ${i} of ${n}`, W - 32, doc.internal.pageSize.getHeight() - 16, { align: 'right' }); }
  doc.save(`User_Audit_${opts.userName.replace(/[^a-z0-9]+/gi, '_')}.pdf`);
}
