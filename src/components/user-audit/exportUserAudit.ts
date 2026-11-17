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
    const h = ws[XLSX.utils.encode_cell({ r: 2, c })]; if (h) h.s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: BLUE } }, alignment: { vertical: 'center' }, border };
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

export function exportUserAudit(opts: {
  userName: string;
  summary: Record<string, any>;
  vendors: { vendor: Record<string, any>; relation: string }[];
  actions: Record<string, any>[];
  pending: Record<string, any>[];
  activity: Record<string, any>[];
  all?: Record<string, any>[];
}) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(Object.entries(opts.summary).map(([Metric, Value]) => ({ Metric, Value })), `Ramky Group – User Audit Report – ${opts.userName}`), 'Summary');
  if (opts.all) XLSX.utils.book_append_sheet(wb, sheet(opts.all, `Audit Records – ${opts.userName}`, 'Action'), 'All Records');
  XLSX.utils.book_append_sheet(wb, sheet(opts.vendors.map(({ vendor, relation }) => ({ 'User Relation': relation, ...flatVendor(vendor) })), 'Vendors'), 'Vendors');
  XLSX.utils.book_append_sheet(wb, sheet(opts.actions, 'Approval Actions'), 'Approval Actions');
  XLSX.utils.book_append_sheet(wb, sheet(opts.pending, 'Pending Queue'), 'Pending Queue');
  XLSX.utils.book_append_sheet(wb, sheet(opts.activity, 'Activity Log'), 'Activity Log');
  const safe = opts.userName.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'User';
  XLSX.writeFile(wb, `User_Audit_${safe}_${formatDate(new Date())}.xlsx`);
}
