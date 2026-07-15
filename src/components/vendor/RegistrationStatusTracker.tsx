import * as React from 'react';
import { CheckCircle2, Clock, FileCheck, ShoppingCart, ShieldCheck, IndianRupee, Server, UserCheck, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RegistrationStatus =
  | 'draft'
  | 'submitted'
  | 'validation_pending'
  | 'validation_failed'
  | 'buyer_review'
  | 'buyer_rejected'
  | 'scm_manager_review'
  | 'scm_manager_rejected'
  | 'scm_head_review'
  | 'scm_head_rejected'
  | 'finance_1_review'
  | 'finance_1_rejected'
  | 'finance_2_review'
  | 'finance_2_rejected'
  | 'ceo_office_review'
  | 'ceo_office_rejected'
  | 'pending_sap_sync'
  | 'dms_sync_pending'
  | 'dms_synced'
  | 'sap_synced'
  | 'sap_team_rejected'
  | 'sap_team_closed'
  | 'sap_team_closed'
  | 'returned_to_buyer'
  | 'returned_to_vendor'

  // legacy
  | 'finance_review'
  | 'finance_approved'
  | 'finance_rejected'
  | 'purchase_review'
  | 'purchase_approved'
  | 'purchase_rejected'
  | 'approved'
  | 'rejected';

interface StatusStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

// Fallback layout used only when no approval chain has been provided yet.
const fallbackSteps: StatusStep[] = [
  { id: 'submitted',     label: 'Submitted',           description: 'Registration received',     icon: <FileCheck className="h-5 w-5" /> },
  { id: 'verification',  label: 'Document Verification', description: 'Validating your documents', icon: <Clock className="h-5 w-5" /> },
  { id: 'buyer',         label: 'Buyer Approval',      description: 'Awaiting Buyer',            icon: <UserCheck className="h-5 w-5" /> },
  { id: 'scm_manager',   label: 'SCM CO',              description: 'Awaiting SCM CO',           icon: <ShoppingCart className="h-5 w-5" /> },
  { id: 'scm_head',      label: 'SCM Head Approval',   description: 'Awaiting SCM Head',         icon: <ShieldCheck className="h-5 w-5" /> },
  { id: 'finance_1',     label: 'Finance 1 Approval',  description: 'Awaiting Finance 1',        icon: <IndianRupee className="h-5 w-5" /> },
  { id: 'finance_2',     label: 'Finance 2 Approval',  description: 'Awaiting Finance 2',        icon: <IndianRupee className="h-5 w-5" /> },
  { id: 'sap',           label: 'SAP Sync',            description: 'Vendor code created',       icon: <Server className="h-5 w-5" /> },
];

function getFallbackActiveIndex(status: RegistrationStatus): number {
  switch (status) {
    case 'draft': return -1;
    case 'submitted':
    case 'validation_pending':
    case 'validation_failed':
      return 1;
    case 'buyer_review':
    case 'buyer_rejected':
      return 2;
    case 'scm_manager_review':
    case 'scm_manager_rejected':
    case 'purchase_review':
      return 3;
    case 'scm_head_review':
    case 'scm_head_rejected':
      return 4;
    case 'finance_1_review':
    case 'finance_1_rejected':
    case 'finance_review':
      return 5;
    case 'finance_2_review':
    case 'finance_2_rejected':
    case 'ceo_office_review':
    case 'ceo_office_rejected':
      return 6;
    case 'pending_sap_sync':
    case 'purchase_approved':
    case 'finance_approved':
      return 7;
    case 'sap_synced':
    case 'approved':
      return 8;
    default:
      return 0;
  }
}

const FALLBACK_FAILED_STEP: Partial<Record<RegistrationStatus, number>> = {
  validation_failed: 1,
  buyer_rejected: 2,
  scm_manager_rejected: 3,
  scm_head_rejected: 4,
  finance_1_rejected: 5,
  finance_2_rejected: 6,
  ceo_office_rejected: 6,
  returned_to_buyer: 2,
  returned_to_vendor: 0,
};

export type ApprovalStageKey = 'BUYER' | 'SCM_MANAGER' | 'SCM_HEAD' | 'FINANCE_1' | 'FINANCE_2' | 'CEO_OFFICE';

export interface ApprovalChainEntry {
  level_number: number;
  status: 'pending' | 'approved' | 'rejected';
  stage: ApprovalStageKey;
}

interface RegistrationStatusTrackerProps {
  status: RegistrationStatus;
  className?: string;
  approvalProgress?: ApprovalChainEntry[];
  sapVendorCode?: string | null;
}

type StepStatus = 'completed' | 'active' | 'pending' | 'failed';

const STAGE_META: Record<ApprovalStageKey, { label: string; icon: React.ReactNode }> = {
  BUYER:       { label: 'Buyer Approval',     icon: <UserCheck className="h-5 w-5" /> },
  SCM_MANAGER: { label: 'SCM CO',             icon: <ShoppingCart className="h-5 w-5" /> },
  SCM_HEAD:    { label: 'SCM Head Approval',  icon: <ShieldCheck className="h-5 w-5" /> },
  FINANCE_1:   { label: 'Finance 1 Approval', icon: <IndianRupee className="h-5 w-5" /> },
  FINANCE_2:   { label: 'Finance 2 Approval', icon: <IndianRupee className="h-5 w-5" /> },
  CEO_OFFICE:  { label: 'CEO Office Approval', icon: <Building2 className="h-5 w-5" /> },
};

// Order used when a vendor has multiple rows for the same stage — we still
// only render one step per stage, in this canonical order.
const STAGE_ORDER: ApprovalStageKey[] = [
  'BUYER', 'SCM_MANAGER', 'SCM_HEAD', 'FINANCE_1', 'FINANCE_2', 'CEO_OFFICE',
];

interface RenderStep extends StatusStep {
  status: StepStatus;
  description: string;
}

function aggregateStageStatus(
  rows: ApprovalChainEntry[],
  isFirstPendingHere: boolean,
): StepStatus {
  if (rows.some((r) => r.status === 'rejected')) return 'failed';
  if (rows.every((r) => r.status === 'approved')) return 'completed';
  if (isFirstPendingHere) return 'active';
  return 'pending';
}

export const RegistrationStatusTracker = React.forwardRef<HTMLDivElement, RegistrationStatusTrackerProps>(
  function RegistrationStatusTracker({ status, className, approvalProgress, sapVendorCode }, ref) {
    const hasChain = (approvalProgress?.length ?? 0) > 0;
    const sapCodePresent = !!sapVendorCode;
    const sapSynced = status === 'sap_synced' || status === 'dms_synced' || status === 'approved' || (sapCodePresent && status !== 'pending_sap_sync' && status !== 'dms_sync_pending');

    let renderSteps: RenderStep[] = [];

    if (hasChain) {
      const sorted = [...approvalProgress!].sort((a, b) => a.level_number - b.level_number);
      const firstPending = sorted.find((r) => r.status === 'pending');

      // Group rows by stage, preserving canonical stage order.
      const stagesPresent = STAGE_ORDER.filter((s) => sorted.some((r) => r.stage === s));

      // Submitted (always completed once any chain exists) + Document Verification.
      renderSteps.push({
        id: 'submitted',
        label: 'Submitted',
        description: 'Registration received',
        icon: <FileCheck className="h-5 w-5" />,
        status: 'completed',
      });
      renderSteps.push({
        id: 'verification',
        label: 'Document Verification',
        description: 'Completed',
        icon: <Clock className="h-5 w-5" />,
        status: 'completed',
      });

      for (const stage of stagesPresent) {
        const stageRows = sorted.filter((r) => r.stage === stage);
        const isFirstPendingHere = !!firstPending && firstPending.stage === stage;
        const stageStatus = aggregateStageStatus(stageRows, isFirstPendingHere);
        const meta = STAGE_META[stage];
        renderSteps.push({
          id: stage.toLowerCase(),
          label: meta.label,
          description:
            stageStatus === 'completed' ? 'Completed'
            : stageStatus === 'active' ? 'In Progress'
            : stageStatus === 'failed' ? 'Action required'
            : 'Pending',
          icon: meta.icon,
          status: stageStatus,
        });
      }

      // SAP Sync final step.
      const allApproved = sorted.every((r) => r.status === 'approved');
      let sapStatus: StepStatus;
      let sapDescription: string;
      if (status === 'sap_team_rejected' || status === 'sap_team_closed') {
        sapStatus = 'failed';
        sapDescription = 'Action required';
      } else if (sapSynced) {
        sapStatus = 'completed';
        sapDescription = sapVendorCode ? `SAP Synced · ${sapVendorCode}` : 'SAP Synced';
      } else if (sapCodePresent) {
        // BP created in SAP but full sync (incl. DMS) not yet marked complete.
        sapStatus = 'active';
        sapDescription = `DMS Pending · ${sapVendorCode}`;
      } else if (status === 'pending_sap_sync' || allApproved) {
        sapStatus = 'active';
        sapDescription = 'SAP Sync Pending';
      } else {
        sapStatus = 'pending';
        sapDescription = 'Awaiting SAP sync';
      }
      renderSteps.push({
        id: 'sap',
        label: 'SAP Sync',
        description: sapDescription,
        icon: <Server className="h-5 w-5" />,
        status: sapStatus,
      });
    } else {
      // Fallback: fixed 8-step layout driven by status enum.
      const activeIndex = getFallbackActiveIndex(status);
      const adjustedActive = status !== 'draft' ? Math.max(activeIndex, 0) : activeIndex;
      renderSteps = fallbackSteps.map((step, index) => {
        let stepStatus: StepStatus;
        if (FALLBACK_FAILED_STEP[status] === index) stepStatus = 'failed';
        else if (index === 0 && status !== 'draft') stepStatus = 'completed';
        else if (index < adjustedActive) stepStatus = 'completed';
        else if (index === adjustedActive) stepStatus = 'active';
        else stepStatus = 'pending';

        let description = step.description;
        if (step.id === 'sap') {
          if (stepStatus === 'completed') {
            description = sapVendorCode ? `SAP Synced · ${sapVendorCode}` : 'SAP Synced';
          } else if (stepStatus === 'active') {
            description = 'SAP Sync Pending';
          } else if (stepStatus === 'failed') {
            description = 'Action required';
          } else {
            description = 'Awaiting SAP sync';
          }
        } else if (stepStatus === 'active') description = 'In Progress';
        else if (stepStatus === 'completed') description = 'Completed';
        else if (stepStatus === 'failed') description = 'Action required';

        return { ...step, status: stepStatus, description };
      });
    }

    // Connector fill ratio.
    const totalSegments = Math.max(renderSteps.length - 1, 1);
    const lastCompletedIdx = renderSteps.reduce(
      (acc, s, i) => (s.status === 'completed' ? i : acc),
      -1,
    );
    const activeIdx = renderSteps.findIndex((s) => s.status === 'active');
    const effectiveActive = activeIdx >= 0 ? activeIdx : Math.max(lastCompletedIdx, 0);
    const fillRatio = effectiveActive <= 0 ? 0 : Math.min(1, effectiveActive / totalSegments);

    return (
      <div ref={ref} className={cn("w-full", className)}>
        <div className="relative">
          <div className="absolute top-5 left-5 right-5 h-0.5 bg-muted" />
          <div
            className="absolute top-5 left-5 h-0.5 bg-primary transition-all duration-500"
            style={{ width: `calc((100% - 40px) * ${fillRatio})` }}
          />

          <div className="relative flex justify-between">
            {renderSteps.map((step) => (
              <div key={step.id} className="flex flex-col items-center" style={{ width: `${100 / renderSteps.length}%` }}>
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                    step.status === 'completed' && "bg-primary border-primary text-primary-foreground",
                    step.status === 'active' && "bg-primary/20 border-primary text-primary animate-pulse",
                    step.status === 'pending' && "bg-background border-muted text-muted-foreground",
                    step.status === 'failed' && "bg-destructive/20 border-destructive text-destructive"
                  )}
                >
                  {step.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : step.icon}
                </div>
                <div className="mt-3 text-center">
                  <p className={cn(
                    "text-xs font-medium",
                    step.status === 'completed' && "text-primary",
                    step.status === 'active' && "text-primary",
                    step.status === 'pending' && "text-muted-foreground",
                    step.status === 'failed' && "text-destructive"
                  )}>{step.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 hidden md:block">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
);
