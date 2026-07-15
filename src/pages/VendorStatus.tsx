import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { RegistrationStatusTracker, RegistrationStatus } from '@/components/vendor/RegistrationStatusTracker';
import { ApprovalTimeline } from '@/components/vendor/ApprovalTimeline';
import { useVendorApprovalChain } from '@/hooks/useVendorApprovalChain';

import { pickVendorDisplayName } from '@/lib/sapPayloadBuilder';

interface VendorRow {
  id: string;
  reference_number: string | null;
  legal_name: string | null;
  trade_name: string | null;
  account_holder_name: string | null;
  gstin: string | null;
  primary_email: string | null;
  vendor_type: string | null;
  status: string;
  created_at: string;
  last_rejection_comments: string | null;
  sap_vendor_code: string | null;
}


const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  submitted: { label: 'Submitted', variant: 'secondary' },
  validation_pending: { label: 'Validating', variant: 'outline' },
  validation_failed: { label: 'Validation Failed', variant: 'destructive' },
  buyer_review: { label: 'Buyer Review', variant: 'outline' },
  scm_manager_review: { label: 'SCM CO', variant: 'outline' },
  scm_manager_rejected: { label: 'SCM CO', variant: 'destructive' },
  scm_head_review: { label: 'SCM Head Review', variant: 'outline' },
  scm_head_rejected: { label: 'SCM Head Rejected', variant: 'destructive' },
  finance_1_review: { label: 'Finance 1 Review', variant: 'outline' },
  finance_1_rejected: { label: 'Finance 1 Rejected', variant: 'destructive' },
  finance_2_review: { label: 'Finance 2 Review', variant: 'outline' },
  finance_2_rejected: { label: 'Finance 2 Rejected', variant: 'destructive' },
  ceo_office_review: { label: 'CEO Office Review', variant: 'outline' },
  ceo_office_rejected: { label: 'CEO Office Rejected', variant: 'destructive' },
  pending_sap_sync: { label: 'Pending SAP Sync', variant: 'default' },
  dms_sync_pending: { label: 'DMS Sync Pending', variant: 'default' },
  sap_synced: { label: 'SAP Synced', variant: 'default' },
  dms_synced: { label: 'Approved (DMS Synced)', variant: 'default' },
  returned_to_buyer: { label: 'Returned to Buyer', variant: 'destructive' },
  returned_to_vendor: { label: 'Returned to Vendor', variant: 'destructive' },
  sap_team_rejected: { label: 'Duplicate & Closed', variant: 'destructive' },
  sap_team_closed: { label: 'Duplicate & Closed', variant: 'destructive' },
};

export default function VendorStatus() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { rows: approvalChain } = useVendorApprovalChain(id);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('vendors')
        .select('id, reference_number, legal_name, trade_name, account_holder_name, gstin, primary_email, vendor_type, status, created_at, last_rejection_comments, sap_vendor_code')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        setError(error.message);
      } else if (!data) {
        setError('Vendor not found or you do not have access.');
      } else {
        setVendor(data as unknown as VendorRow);
      }

      setLoading(false);
    })();
  }, [id]);

  const badge = vendor ? (STATUS_LABELS[vendor.status] ?? { label: vendor.status, variant: 'secondary' as const }) : null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" onClick={() => navigate('/dashboard')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-2xl font-semibold">Vendor Status</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error || !vendor ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {error ?? 'Vendor not found.'}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendor Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Reference Number" value={vendor.reference_number ?? '—'} mono />
                <Field label="Company Name" value={pickVendorDisplayName(vendor) || '—'} />
                <Field label="Email" value={vendor.primary_email ?? '—'} />

                <Field label="Vendor Type" value={vendor.vendor_type ?? '—'} />
                <Field label="Submitted On" value={format(new Date(vendor.created_at), 'dd MMM yyyy, HH:mm')} />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Current Status</p>
                  {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                </div>
                {(() => {
                  const s = vendor.status;
                  const code = vendor.sap_vendor_code;
                  const inSap = !!code || ['pending_sap_sync','dms_sync_pending','sap_synced','dms_synced','sap_team_rejected','sap_team_closed'].includes(s);
                  if (!inSap) return null;
                  let text = 'SAP Sync Pending';
                  let variant: 'default' | 'outline' | 'destructive' = 'outline';
                  if (s === 'sap_synced' || s === 'dms_synced') {
                    text = code ? `SAP Synced · ${code}` : 'SAP Synced';
                    variant = 'default';
                  } else if (s === 'dms_sync_pending') {
                    text = code ? `DMS Pending · ${code}` : 'DMS Pending';
                  } else if (s === 'pending_sap_sync') {
                    text = code ? `DMS Pending · ${code}` : 'SAP Sync Pending';
                  } else if (s === 'sap_team_rejected' || s === 'sap_team_closed') {
                    text = 'Duplicate & Closed';
                    variant = 'destructive';
                  } else if (code) {
                    text = `SAP Synced · ${code}`;
                    variant = 'default';
                  }
                  return (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">SAP Sync Status</p>
                      <Badge variant={variant}>{text}</Badge>
                    </div>
                  );
                })()}
              </div>
              {vendor.last_rejection_comments && (
                <div className="mt-4 p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-900">
                  <span className="font-medium">Latest comment:</span> {vendor.last_rejection_comments}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Application Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <RegistrationStatusTracker
                status={vendor.status as RegistrationStatus}
                approvalProgress={approvalChain}
                sapVendorCode={vendor.sap_vendor_code}
              />
            </CardContent>
          </Card>

          <ApprovalTimeline vendorId={vendor.id} />
        </>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
