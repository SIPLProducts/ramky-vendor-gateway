import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateTime } from '@/lib/dateFormat';
import logoUrl from '@/assets/ramky-logo.png';

type RGB = [number, number, number];
const BLUE: RGB = [0, 91, 161], ORANGE: RGB = [232, 120, 23], GREEN: RGB = [0, 161, 58], SKY: RGB = [47, 180, 234];
export const ACTION_TINT: Record<string, RGB> = {
  Pending: [253, 230, 204], Approved: [214, 241, 222], Rejected: [253, 220, 220], Returned: [254, 243, 199], Invited: [217, 240, 251], 'On Behalf': [224, 236, 250],
};
type Rows = Record<string, any>[];

async function loadLogo(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const img = new Image(); img.src = logoUrl; await img.decode();
    const sc = 220 / img.naturalHeight; const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = 220;
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight };
  } catch { return null; }
}

export async function exportUserAuditPdf(opts: { userName: string; summary: Record<string, any>; all: Rows }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const logo = await loadLogo();
  if (logo) { const h = 54, w = (logo.w / logo.h) * h; doc.addImage(logo.data, 'PNG', 28, 14, w, h); }
  doc.setTextColor(...BLUE); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('User Audit Report', W / 2, 38, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  doc.text(opts.userName, W - 28, 32, { align: 'right' });
  doc.text(`Generated ${formatDateTime(new Date())}`, W - 28, 46, { align: 'right' });
  const sw = W / 3;
  doc.setFillColor(...BLUE); doc.rect(0, 76, sw, 4, 'F');
  doc.setFillColor(...ORANGE); doc.rect(sw, 76, sw, 4, 'F');
  doc.setFillColor(...GREEN); doc.rect(sw * 2, 76, sw, 4, 'F');

  const e = Object.entries(opts.summary); const body: string[][] = [];
  for (let i = 0; i < e.length; i += 3) body.push([0, 1, 2].flatMap((k) => (e[i + k] ? [e[i + k][0], String(e[i + k][1] ?? '')] : ['', ''])));
  autoTable(doc, {
    startY: 92, theme: 'grid', body, styles: { fontSize: 8, cellPadding: 4, lineColor: [210, 225, 240] },
    columnStyles: { 0: { fillColor: [232, 242, 251], textColor: BLUE, fontStyle: 'bold' }, 2: { fillColor: [232, 242, 251], textColor: BLUE, fontStyle: 'bold' }, 4: { fillColor: [232, 242, 251], textColor: BLUE, fontStyle: 'bold' } },
  });

  let y = (doc as any).lastAutoTable.finalY + 22;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BLUE); doc.text(`Audit Records (${opts.all.length})`, 28, y);
  doc.setFillColor(...ORANGE); doc.rect(28, y + 4, 60, 2, 'F');
  if (!opts.all.length) { autoTable(doc, { startY: y + 12, body: [['No Records Found']], styles: { fontSize: 8 } }); }
  else {
    const cols = Object.keys(opts.all[0]);
    autoTable(doc, {
      startY: y + 12, theme: 'grid', head: [cols], body: opts.all.map((r) => cols.map((c) => String(r[c] ?? ''))),
      styles: { fontSize: 7, cellPadding: 3, lineColor: [220, 228, 238], overflow: 'linebreak' },
      headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
      margin: { bottom: 40 },
      didParseCell: (d) => {
        if (d.section !== 'body') return;
        const f = ACTION_TINT[String((opts.all[d.row.index] as any).Action)]; if (f) d.cell.styles.fillColor = f;
        if (d.column.index === 1) { d.cell.styles.fontStyle = 'bold'; }
      },
    });
  }
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setDrawColor(...BLUE); doc.setLineWidth(0.8); doc.line(28, H - 28, W - 28, H - 28);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLUE);
    doc.text('Ramky Group · Vyapaar Portal', 28, H - 16);
    doc.setTextColor(...SKY); doc.text(`Page ${i} of ${n}`, W - 28, H - 16, { align: 'right' });
  }
  doc.save(`User_Audit_${opts.userName.replace(/[^a-z0-9]+/gi, '_')}.pdf`);
}
