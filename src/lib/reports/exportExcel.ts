import * as XLSX from 'xlsx';
import { STAGE_ORDER, STAGE_LABEL, type VendorReportRow } from './loadVendorReport';

function fmt(d: string | null): string {
  if (!d) return '';
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

export function exportVendorExcel(rows: VendorReportRow[], reportType: 'vendor' | 'approval') {
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

  if (reportType === 'approval') {
    const flow: any[] = [];
    rows.forEach((r) => {
      STAGE_ORDER.forEach((s) => {
        const info = r.stages[s];
        flow.push({
          'Reference #': r.reference_number,
          'Vendor Name': r.vendor_name,
          'Stage': STAGE_LABEL[s],
          'Approver': info.approver_name,
          'Status': info.status,
          'Acted At': fmt(info.acted_at),
          'Remarks': info.remarks,
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flow), 'Approval Flow');
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  XLSX.writeFile(wb, `${reportType === 'approval' ? 'approval-flow' : 'vendor'}-report-${stamp}.xlsx`);
}
