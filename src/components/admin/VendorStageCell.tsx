import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertCircle, Circle } from 'lucide-react';

export type VendorLite = {
  id: string;
  reference_number: string | null;
  status: string | null;
} | null | undefined;

const PIPELINE = [
  { key: 'BUYER', label: 'Buyer' },
  { key: 'SCM_MANAGER', label: 'SCM CO' },
  { key: 'SCM_HEAD', label: 'SCM Head' },
  { key: 'FINANCE_1', label: 'Finance 1' },
  { key: 'FINANCE_2', label: 'Finance 2' },
  { key: 'CEO_OFFICE', label: 'CEO Office' },
  { key: 'SAP_SYNC', label: 'SAP Sync' },
];

// Returns 1-based index of current pipeline step, 0 if not started, or special values.
function statusToStep(status: string | null | undefined): {
  step: number;
  label: string;
  tone: 'muted' | 'progress' | 'success' | 'warning' | 'destructive';
} {
  switch (status) {
    case null:
    case undefined:
    case '':
      return { step: 0, label: 'Not Started', tone: 'muted' };
    case 'draft':
    case 'submitted':
    case 'validation_pending':
    case 'buyer_review':
      return { step: 1, label: 'Buyer Review', tone: 'progress' };
    case 'scm_manager_review':
      return { step: 2, label: 'SCM CO', tone: 'progress' };
    case 'scm_head_review':
      return { step: 3, label: 'SCM Head Review', tone: 'progress' };
    case 'finance_1_review':
      return { step: 4, label: 'Finance 1 Review', tone: 'progress' };
    case 'finance_2_review':
      return { step: 5, label: 'Finance 2 Review', tone: 'progress' };
    case 'ceo_office_review':
      return { step: 6, label: 'CEO Office Review', tone: 'progress' };
    case 'pending_sap_sync':
      return { step: 7, label: 'Pending SAP Sync', tone: 'progress' };
    case 'sap_synced':
      return { step: 8, label: 'Approved (SAP Synced)', tone: 'success' };
    case 'sap_team_rejected':
    case 'sap_team_closed':
      return { step: -1, label: 'Duplicate & Closed', tone: 'destructive' };
    case 'returned_to_vendor':
      return { step: -1, label: 'Returned to Vendor', tone: 'warning' };
    case 'returned_to_buyer':
      return { step: -1, label: 'Returned to Buyer', tone: 'warning' };
    default:
      return { step: 0, label: status, tone: 'muted' };
  }
}

const TONE_CLASSES: Record<string, string> = {
  muted: 'bg-muted text-muted-foreground border-transparent',
  progress: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success/15 text-success border-success/30',
  warning: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300',
  destructive: 'bg-destructive/10 text-destructive border-destructive/20',
};

const TONE_ICON: Record<string, JSX.Element | null> = {
  muted: <Circle className="h-3 w-3" />,
  progress: <Circle className="h-3 w-3 animate-pulse" />,
  success: <CheckCircle2 className="h-3 w-3" />,
  warning: <AlertCircle className="h-3 w-3" />,
  destructive: <XCircle className="h-3 w-3" />,
};

export function VendorStageCell({ vendor }: { vendor: VendorLite }) {
  const status = vendor?.status ?? null;
  const { step, label, tone } = statusToStep(status);

  return (
    <div className="flex flex-col gap-1.5 min-w-[200px]">
      <Badge variant="outline" className={cn('gap-1 w-fit font-medium', TONE_CLASSES[tone])}>
        {TONE_ICON[tone]}
        {label}
      </Badge>
      <TooltipProvider delayDuration={150}>
        <div className="flex items-center gap-1">
          {PIPELINE.map((s, i) => {
            const idx = i + 1;
            let cls = 'bg-muted';
            if (step === 8) cls = 'bg-success';
            else if (tone === 'destructive') cls = idx <= 6 ? 'bg-destructive/60' : 'bg-muted';
            else if (tone === 'warning') cls = idx === 1 ? 'bg-amber-400' : 'bg-muted';
            else if (step > 0) {
              if (idx < step) cls = 'bg-primary';
              else if (idx === step) cls = 'bg-primary ring-2 ring-primary/30';
              else cls = 'bg-muted';
            }
            return (
              <Tooltip key={s.key}>
                <TooltipTrigger asChild>
                  <span className={cn('h-1.5 w-6 rounded-full transition-colors', cls)} />
                </TooltipTrigger>
                <TooltipContent side="top">{s.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}

export function VendorReferenceCell({ vendor }: { vendor: VendorLite }) {
  if (!vendor?.reference_number) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  return (
    <Link
      to={`/vendors/${vendor.id}`}
      className="font-mono text-xs text-primary hover:underline"
    >
      {vendor.reference_number}
    </Link>
  );
}

// Filter helpers used by the page
export const STAGE_FILTER_OPTIONS = [
  { value: 'stage:buyer', label: 'Stage: Buyer', statuses: ['draft', 'submitted', 'validation_pending', 'buyer_review'] },
  { value: 'stage:scm_manager', label: 'Stage: SCM CO', statuses: ['scm_manager_review'] },
  { value: 'stage:scm_head', label: 'Stage: SCM Head', statuses: ['scm_head_review'] },
  { value: 'stage:finance_1', label: 'Stage: Finance 1', statuses: ['finance_1_review'] },
  { value: 'stage:finance_2', label: 'Stage: Finance 2', statuses: ['finance_2_review'] },
  { value: 'stage:ceo_office', label: 'Stage: CEO Office', statuses: ['ceo_office_review'] },
  { value: 'stage:pending_sap', label: 'Stage: Pending SAP Sync', statuses: ['pending_sap_sync'] },
  { value: 'stage:sap_synced', label: 'Stage: SAP Synced', statuses: ['sap_synced'] },
  { value: 'stage:rejected', label: 'Stage: Duplicate & Closed', statuses: ['sap_team_rejected', 'sap_team_closed'] },
  { value: 'stage:returned', label: 'Stage: Returned', statuses: ['returned_to_vendor', 'returned_to_buyer'] },
] as const;
