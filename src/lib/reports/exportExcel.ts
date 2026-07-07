import * as XLSX from 'xlsx';
import { STAGE_ORDER, STAGE_LABEL, type VendorReportRow } from './loadVendorReport';
import { formatAadhaarLinked, formatPanStatus } from '@/lib/panComprehensive';

function fmt(d: string | null | undefined): string {
  if (!d) return '';
  try { return new Date(d).toLocaleString(); } catch { return String(d); }
}

function statusLabel(s: string): string {
  if (s === 'skipped') return 'Skipped (not in matrix)';
  if (s === 'pending') return 'Pending';
  if (s === 'approved') return 'Approved';
  if (s === 'rejected') return 'Rejected';
  if (s === 'returned') return 'Returned';
  return s;
}

function detailValue(key: string, value: any): string {
  if (key === 'pan_aadhaar_linked') return formatAadhaarLinked(value as boolean | null | undefined);
  if (key === 'pan_status') return formatPanStatus(value as string | null | undefined);
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function exportVendorExcel(rows: VendorReportRow[], reportType: 'vendor' | 'approval' | 'both') {
  const wb = XLSX.utils.book_new();

  const vendorSheet = rows.map((r) => ({
    'Reference #': r.reference_number,
    'Vendor Name': r.vendor_name,
    'Type': r.vendor_type,
    'Invited Email': r.invited_email,
    'Invited At': fmt(r.invited_at),
    'Submitted At': fmt(r.submitted_at),
    'On Behalf': r.on_behalf ? 'Yes' : 'No',
    'Current Stage': r.current_stage,
    'Final Status': r.final_status,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendorSheet), 'Vendors');

  // Approval flow sheet (one row per vendor x stage)
  const flow: any[] = [];
  rows.forEach((r) => {
    STAGE_ORDER.forEach((s) => {
      const info = r.stages[s];
      flow.push({
        'Reference #': r.reference_number,
        'Vendor Name': r.vendor_name,
        'Stage': STAGE_LABEL[s],
        'Approver': info.status === 'skipped' ? '—' : info.approver_name,
        'Status': statusLabel(info.status),
        'Acted At': info.status === 'skipped' ? '' : fmt(info.acted_at),
        'Remarks': info.status === 'skipped' ? '' : info.remarks,
      });
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flow), 'Approval Flow');

  // Single-vendor: include full details, documents, validations
  if (rows.length === 1 && rows[0].details) {
    const d = rows[0].details;
    const kv = Object.entries(d)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => ({ Field: k, Value: detailValue(k, v) }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kv), 'Vendor Details');

    if (rows[0].documents && rows[0].documents.length) {
      const docs = rows[0].documents.map((doc) => ({
        'Document Type': doc.document_type,
        'File Name': doc.file_name,
        'Uploaded At': fmt(doc.uploaded_at),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(docs), 'Documents');
    }
    if (rows[0].validations && rows[0].validations.length) {
      const vals = rows[0].validations.map((v) => ({
        'Validation': v.validation_type,
        'Status': v.status,
        'Verified At': fmt(v.verified_at),
        'Details': v.details ? JSON.stringify(v.details) : '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vals), 'Validations');
    }
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  XLSX.writeFile(wb, `${reportType === 'approval' ? 'approval-flow' : 'vendor'}-report-${stamp}.xlsx`);
}
