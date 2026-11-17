import * as XLSX from 'xlsx';
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

function sheet(rows: Record<string, any>[]) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'No Records' }]);
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
}) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(Object.entries(opts.summary).map(([Metric, Value]) => ({ Metric, Value }))), 'Summary');
  XLSX.utils.book_append_sheet(wb, sheet(opts.vendors.map(({ vendor, relation }) => ({ 'User Relation': relation, ...flatVendor(vendor) }))), 'Vendors');
  XLSX.utils.book_append_sheet(wb, sheet(opts.actions), 'Approval Actions');
  XLSX.utils.book_append_sheet(wb, sheet(opts.pending), 'Pending Queue');
  XLSX.utils.book_append_sheet(wb, sheet(opts.activity), 'Activity Log');
  const safe = opts.userName.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'User';
  XLSX.writeFile(wb, `User_Audit_${safe}_${formatDate(new Date())}.xlsx`);
}
