import XLSXmod from 'xlsx-js-style';
const XLSX: any = (XLSXmod as any).utils ? XLSXmod : (XLSXmod as any).default;
import { formatDate, formatDateTime } from '@/lib/dateFormat';
import { titleCase } from '@/lib/userAudit';

const SKIP = new Set(['custom_field_values']);
const DATE_KEYS = /(_at|_date)$/;

function flatVendor(v: Record<string, any>) {
  const out: Record<string, any> = {};
  Object.entries(v).forEach(([k, val]) => {
    if (SKIP.has(k) || k === 'vendor_invitations') return;
    const label = titleCase(k);
    if (val == null) out[label] = '';
    else if (DATE_KEYS.test(k) && typeof val === 'string') out[label] = k.endsWith('_date') ? formatDate(val) : formatDateTime(val);
    else if (Array.isArray(val)) out[label] = val.map((x) => (typeof x === 'object' ? JSON.stringify(x) : x)).join(', ');
    else if (typeof val === 'object') out[label] = JSON.stringify(val);
    else if (typeof val === 'boolean') out[label] = val ? 'Yes' : 'No';
    else out[label] = val;
  });
  return out;
}

const BLUE = '005BA1';
const TINT: Record<string, string> = { Pending: 'FDE6CC', Approved: 'D6F1DE', Rejected: 'FDDCDC', Returned: 'FEF3C7', Invited: 'D9F0FB', 'On Behalf': 'E0ECFA' };
const border = { top: { style: 'thin', color: { rgb: 'D2E1F0' } }, bottom: { style: 'thin', color: { rgb: 'D2E1F0' } }, left: { style: 'thin', color: { rgb: 'D2E1F0' } }, right: { style: 'thin', color: { rgb: 'D2E1F0' } } };
function styleSheet(ws: any, rows: Record<string, any>[], title: string, tintKey?: string) {
  const keys = Object.keys(rows[0] || { Info: '' });
  XLSX.utils.sheet_add_aoa(ws, [[title], []], { origin: 'A1' });
  const range = XLSX.utils.decode_range(ws['!ref']);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(keys.length - 1, 1) } }];
  ws.A1.s = { font: { bold: true, sz: 14, color: { rgb: BLUE } }, fill: { fgColor: { rgb: 'EAF3FB' } } };
  for (let c = 0; c < keys.length; c++) {
    const h = ws[XLSX.utils.encode_cell({ r: 2, c })]; if (h) h.s = { font: { bold: true, color: { rgb: BLUE } }, fill: { fgColor: { rgb: 'E8F2FB' } }, alignment: { vertical: 'center' }, border: { ...border, bottom: { style: 'medium', color: { rgb: BLUE } } } };
    for (let r = 3; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (!cell) continue;
      const row = rows[r - 3]; const tint = tintKey && row ? TINT[String(row[tintKey])] : undefined;
      cell.s = { border, fill: { fgColor: { rgb: tint ?? (r % 2 ? 'FFFFFF' : 'F5F9FD') } }, font: { sz: 10, bold: tintKey ? c === 1 : c === 0, color: { rgb: !tintKey && c === 0 ? BLUE : '1F2937' } } };
    }
  }
  ws['!freeze'] = { xSplit: 0, ySplit: 3 }; ws['!views'] = [{ state: 'frozen', ySplit: 3 }];
}
function sheet(rows: Record<string, any>[], title = '', tintKey?: string) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'No Records' }], { origin: 'A3' } as any);
  styleSheet(ws, rows.length ? rows : [{ Info: 'No Records' }], title, tintKey);
  const keys = Object.keys(rows[0] || { Info: '' });
  ws['!cols'] = keys.map((k) => ({ wch: Math.min(45, Math.max(12, k.length + 2, ...rows.slice(0, 50).map((r) => String(r[k] ?? '').length))) }));
  return ws;
}

export function exportUserAudit(opts: { userName: string; user: Record<string, string>; all: Record<string, any>[] }) {
  const cols = Object.keys(opts.all[0] || { 'Action Date': '', Action: '', 'Ref No': '', 'Vendor Name': '' });
  const n = cols.length;
  const uf = Object.entries(opts.user);
  const aoa: any[][] = [[`Ramky Group – User Audit Report`], [`Generated ${formatDateTime(new Date())}`], []];
  for (let i = 0; i < uf.length; i += 3) aoa.push([0, 1, 2].flatMap((k) => (uf[i + k] ? [uf[i + k][0], uf[i + k][1]] : ['', ''])));
  aoa.push([]);
  const hr = aoa.length;
  aoa.push(cols);
  opts.all.forEach((r) => aoa.push(cols.map((c) => r[c] ?? '')));
  if (!opts.all.length) aoa.push(['No Records Found']);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const last = Math.max(n - 1, 5);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: last } }, { s: { r: 1, c: 0 }, e: { r: 1, c: last } }];
  const set = (r: number, c: number, st: any) => { const a = XLSX.utils.encode_cell({ r, c }); if (!ws[a]) ws[a] = { t: 's', v: '' }; ws[a].s = st; };
  for (let c = 0; c <= last; c++) { set(0, c, { font: { bold: true, sz: 15, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: BLUE } } }); set(1, c, { font: { sz: 9, italic: true, color: { rgb: BLUE } }, fill: { fgColor: { rgb: 'FFF1E3' } } }); }
  for (let r = 3; r < hr - 1; r++) for (let c = 0; c < 6; c++)
    set(r, c, { border, fill: { fgColor: { rgb: c % 2 ? 'F3FAF5' : 'E8F2FB' } }, font: { sz: 10, bold: c % 2 === 0, color: { rgb: c % 2 ? '1F2937' : BLUE } } });
  for (let c = 0; c < n; c++) {
    set(hr, c, { font: { bold: true, color: { rgb: BLUE } }, fill: { fgColor: { rgb: 'E8F2FB' } }, alignment: { vertical: 'center' }, border: { ...border, bottom: { style: 'medium', color: { rgb: BLUE } } } });
    opts.all.forEach((row, i) => { const tint = TINT[String(row.Action)];
      set(hr + 1 + i, c, { border, fill: { fgColor: { rgb: tint ?? (i % 2 ? 'FFFFFF' : 'F5F9FD') } }, font: { sz: 10, bold: c === 1, color: { rgb: '1F2937' } } }); });
  }
  ws['!cols'] = cols.map((k, i) => ({ wch: Math.min(45, Math.max(14, k.length + 2, String(aoa[3 + Math.floor(i / 2)]?.[i] ?? '').length, ...opts.all.slice(0, 50).map((r) => String(r[k] ?? '').length))) }));
  ws['!views'] = [{ state: 'frozen', ySplit: hr + 1 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'User Audit');
  const safe = opts.userName.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'User';
  XLSX.writeFile(wb, `User_Audit_${safe}_${formatDate(new Date())}.xlsx`);
}
