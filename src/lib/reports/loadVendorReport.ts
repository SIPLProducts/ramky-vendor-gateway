import { supabase } from '@/integrations/supabase/client';

export type StageKey = 'BUYER' | 'SCM_MANAGER' | 'SCM_HEAD' | 'FINANCE_1' | 'FINANCE_2' | 'CEO_OFFICE' | 'SAP_TEAM';

export const STAGE_ORDER: StageKey[] = [
  'BUYER', 'SCM_MANAGER', 'SCM_HEAD', 'FINANCE_1', 'FINANCE_2', 'CEO_OFFICE', 'SAP_TEAM',
];

export const STAGE_LABEL: Record<StageKey, string> = {
  BUYER: 'Buyer',
  SCM_MANAGER: 'SCM Manager',
  SCM_HEAD: 'SCM Head',
  FINANCE_1: 'Finance 1',
  FINANCE_2: 'Finance 2',
  CEO_OFFICE: 'CEO Office',
  SAP_TEAM: 'SAP Team',
};

// Status values returned per stage:
//  'approved' | 'rejected' | 'returned' | 'pending' | 'skipped'
export interface StageInfo {
  approver_name: string;
  status: string;
  acted_at: string | null;
  remarks: string;
}

export interface VendorReportRow {
  vendor_id: string;
  reference_number: string;
  vendor_name: string;
  vendor_type: string;
  status: string;
  invited_at: string | null;
  invited_email: string;
  submitted_at: string | null;
  on_behalf: boolean;
  current_stage: string;
  final_status: string;
  stages: Record<StageKey, StageInfo>;
  // Populated only for single-vendor mode
  details?: Record<string, any>;
  documents?: Array<{
    document_type: string;
    file_name: string;
    uploaded_at: string | null;
    file_path: string | null;
  }>;
  validations?: Array<{
    validation_type: string;
    status: string;
    verified_at: string | null;
    details: any;
  }>;
}

export interface ReportFilters {
  from?: string | null;
  to?: string | null;
  statuses?: string[];
  referenceNumber?: string | null;
}

function skippedStage(): StageInfo {
  return { approver_name: '—', status: 'skipped', acted_at: null, remarks: '' };
}

const REVIEW_STATUS_TO_STAGE: Record<string, StageKey> = {
  buyer_review: 'BUYER',
  scm_manager_review: 'SCM_MANAGER',
  scm_head_review: 'SCM_HEAD',
  finance_1_review: 'FINANCE_1',
  finance_2_review: 'FINANCE_2',
  ceo_office_review: 'CEO_OFFICE',
  pending_sap_sync: 'SAP_TEAM',
};

export async function loadVendorReports(filters: ReportFilters): Promise<VendorReportRow[]> {
  const isSingle = !!filters.referenceNumber;

  let q = supabase
    .from('vendors')
    .select(isSingle ? '*' : 'id, reference_number, legal_name, trade_name, vendor_type, status, created_at, submitted_at, primary_email')
    .order('created_at', { ascending: false });

  if (filters.referenceNumber) q = q.eq('reference_number', filters.referenceNumber);
  if (filters.from) q = q.gte('created_at', filters.from);
  if (filters.to) q = q.lte('created_at', filters.to);
  if (filters.statuses && filters.statuses.length > 0) q = q.in('status', filters.statuses as any);

  const { data: vendors, error } = await q.limit(1000);
  if (error) throw error;
  if (!vendors || vendors.length === 0) return [];

  const vendorIds = vendors.map((v: any) => v.id);

  const [invRes, progRes, sapAuditRes, docsRes, valsRes] = await Promise.all([
    supabase
      .from('vendor_invitations')
      .select('vendor_id, email, created_at, created_on_behalf, created_by')
      .in('vendor_id', vendorIds),
    supabase
      .from('vendor_approval_progress')
      .select('vendor_id, level_number, stage, status, acted_by, acted_at, comments, started_at, completed_at')
      .in('vendor_id', vendorIds)
      .order('level_number', { ascending: true }),
    supabase
      .from('audit_logs')
      .select('user_id, action, details, created_at')
      .in('action', ['sap_sync_completed', 'sap_team_rejected', 'sap_team_return_to_buyer', 'sync_vendor_to_sap'] as any)
      .order('created_at', { ascending: false })
      .limit(2000),
    isSingle
      ? supabase
          .from('vendor_documents')
          .select('document_type, file_name, uploaded_at, file_path')
          .in('vendor_id', vendorIds)
      : Promise.resolve({ data: [] as any[] }),
    isSingle
      ? supabase
          .from('vendor_validations')
          .select('vendor_id, validation_type, status, validated_at, details')
          .in('vendor_id', vendorIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const profileIds = new Set<string>();
  (progRes.data ?? []).forEach((r: any) => { if (r.acted_by) profileIds.add(r.acted_by); });
  (invRes.data ?? []).forEach((r: any) => { if (r.created_by) profileIds.add(r.created_by); });
  (sapAuditRes.data ?? []).forEach((r: any) => { if (r.user_id) profileIds.add(r.user_id); });

  const profMap = new Map<string, string>();
  if (profileIds.size > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', Array.from(profileIds));
    (profs ?? []).forEach((p: any) => profMap.set(p.id, p.full_name || p.email || ''));
  }

  const invByVendor = new Map<string, any>();
  (invRes.data ?? []).forEach((r: any) => {
    const prev = invByVendor.get(r.vendor_id);
    if (!prev || new Date(r.created_at) < new Date(prev.created_at)) invByVendor.set(r.vendor_id, r);
  });

  const progByVendor = new Map<string, any[]>();
  (progRes.data ?? []).forEach((r: any) => {
    if (!progByVendor.has(r.vendor_id)) progByVendor.set(r.vendor_id, []);
    progByVendor.get(r.vendor_id)!.push(r);
  });

  const sapByVendor = new Map<string, any>();
  (sapAuditRes.data ?? []).forEach((r: any) => {
    const vid = r.details?.vendor_id;
    if (!vid || !vendorIds.includes(vid)) return;
    if (!sapByVendor.has(vid)) sapByVendor.set(vid, r);
  });

  const docsByVendor = new Map<string, any[]>();
  ((docsRes as any).data ?? []).forEach((d: any) => {
    if (!docsByVendor.has(d.vendor_id)) docsByVendor.set(d.vendor_id, []);
    docsByVendor.get(d.vendor_id)!.push(d);
  });
  const valsByVendor = new Map<string, any[]>();
  ((valsRes as any).data ?? []).forEach((v: any) => {
    if (!valsByVendor.has(v.vendor_id)) valsByVendor.set(v.vendor_id, []);
    valsByVendor.get(v.vendor_id)!.push(v);
  });

  return vendors.map((v: any) => {
    const inv = invByVendor.get(v.id);
    const progressRows = progByVendor.get(v.id) ?? [];

    // Start with every stage = skipped; fill from progress rows.
    const stages: Record<StageKey, StageInfo> = {
      BUYER: skippedStage(),
      SCM_MANAGER: skippedStage(),
      SCM_HEAD: skippedStage(),
      FINANCE_1: skippedStage(),
      FINANCE_2: skippedStage(),
      CEO_OFFICE: skippedStage(),
      SAP_TEAM: skippedStage(),
    };

    let currentStage = '—';
    progressRows.forEach((r: any) => {
      const key = r.stage as StageKey;
      if (!stages[key]) return;
      const isReturned = r.status === 'returned' || r.status === 'returned_to_buyer' || r.status === 'returned_to_vendor';
      const status = isReturned ? 'returned' : r.status;
      stages[key] = {
        approver_name: r.acted_by
          ? (profMap.get(r.acted_by) || '—')
          : (status === 'pending' ? 'Pending' : '—'),
        status,
        acted_at: r.acted_at,
        remarks: r.comments || '',
      };
      if (status === 'pending' && currentStage === '—') currentStage = STAGE_LABEL[key];
    });

    // SAP Team derived from audit logs + vendor status.
    const sap = sapByVendor.get(v.id);
    if (sap) {
      const action = sap.action;
      const status = action === 'sap_sync_completed' || action === 'sync_vendor_to_sap'
        ? 'approved'
        : 'rejected';
      stages.SAP_TEAM = {
        approver_name: sap.user_id ? (profMap.get(sap.user_id) || 'SAP Team') : 'SAP Team',
        status,
        acted_at: sap.created_at,
        remarks: sap.details?.comments || sap.details?.reason || action,
      };
      if (status === 'approved') currentStage = 'Completed';
    } else if (v.status === 'pending_sap_sync') {
      stages.SAP_TEAM = { approver_name: 'Pending', status: 'pending', acted_at: null, remarks: '' };
      if (currentStage === '—') currentStage = 'SAP Team';
    }

    // If vendor.status maps to a review stage and that stage was marked skipped (no row), mark it pending.
    const mappedStage = REVIEW_STATUS_TO_STAGE[v.status as string];
    if (mappedStage && stages[mappedStage].status === 'skipped') {
      stages[mappedStage] = { approver_name: 'Pending', status: 'pending', acted_at: null, remarks: '' };
      if (currentStage === '—') currentStage = STAGE_LABEL[mappedStage];
    }

    if (v.status === 'sap_synced' || v.status === 'dms_synced') currentStage = 'Completed';

    const row: VendorReportRow = {
      vendor_id: v.id,
      reference_number: v.reference_number || '',
      vendor_name: v.legal_name || v.trade_name || '—',
      vendor_type: v.vendor_type || 'domestic',
      status: v.status || '',
      invited_at: inv?.created_at ?? null,
      invited_email: inv?.email ?? v.primary_email ?? '',
      submitted_at: v.submitted_at,
      on_behalf: !!inv?.created_on_behalf,
      current_stage: currentStage,
      final_status: v.status || '',
      stages,
    };

    if (isSingle) {
      row.details = v;
      row.documents = (docsByVendor.get(v.id) ?? []).map((d: any) => ({
        document_type: d.document_type,
        file_name: d.file_name,
        uploaded_at: d.uploaded_at,
        file_path: d.file_path,
      }));
      row.validations = (valsByVendor.get(v.id) ?? []).map((vv: any) => ({
        validation_type: vv.validation_type,
        status: vv.status,
        verified_at: vv.validated_at,
        details: vv.details,
      }));
    }

    return row;
  });
}
