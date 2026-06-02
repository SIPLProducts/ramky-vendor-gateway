import * as React from 'react';
import { CheckCircle2, Clock, FileCheck, ShoppingCart, ShieldCheck, IndianRupee, Server, UserCheck } from 'lucide-react';
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
  | 'sap_synced'
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

const statusSteps: StatusStep[] = [
  { id: 'submitted',     label: 'Submitted',           description: 'Registration received',     icon: <FileCheck className="h-5 w-5" /> },
  { id: 'verification',  label: 'Document Verification', description: 'Validating your documents', icon: <Clock className="h-5 w-5" /> },
  { id: 'buyer',         label: 'Buyer Approval',      description: 'Awaiting Buyer',            icon: <UserCheck className="h-5 w-5" /> },
  { id: 'scm_manager',   label: 'SCM Manager Approval', description: 'Awaiting SCM Manager',     icon: <ShoppingCart className="h-5 w-5" /> },
  { id: 'scm_head',      label: 'SCM Head Approval',   description: 'Awaiting SCM Head',         icon: <ShieldCheck className="h-5 w-5" /> },
  { id: 'finance_1',     label: 'Finance 1 Approval',  description: 'Awaiting Finance 1',        icon: <IndianRupee className="h-5 w-5" /> },
  { id: 'finance_2',     label: 'Finance 2 Approval',  description: 'Awaiting Finance 2',        icon: <IndianRupee className="h-5 w-5" /> },
  { id: 'sap',           label: 'SAP Sync',            description: 'Vendor code created',       icon: <Server className="h-5 w-5" /> },
];

function getActiveStepIndex(status: RegistrationStatus): number {
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
    case 'purchase_review': // legacy fallback
      return 3;
    case 'scm_head_review':
    case 'scm_head_rejected':
      return 4;
    case 'finance_1_review':
    case 'finance_1_rejected':
    case 'finance_review': // legacy fallback
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
    case 'rejected':
    case 'purchase_rejected':
    case 'finance_rejected':
      return -2;
    default:
      return 0;
  }
}

const FAILED_STEP: Partial<Record<RegistrationStatus, number>> = {
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


function getStepStatus(stepIndex: number, activeIndex: number, vendorStatus: RegistrationStatus): 'completed' | 'active' | 'pending' | 'failed' {
  if (FAILED_STEP[vendorStatus] === stepIndex) return 'failed';
  // Submitted (step 0) is always complete once the form has been submitted.
  if (stepIndex === 0 && vendorStatus !== 'draft') return 'completed';
  if (vendorStatus === 'rejected') return stepIndex < activeIndex ? 'completed' : 'pending';
  if (stepIndex < activeIndex) return 'completed';
  if (stepIndex === activeIndex) return 'active';
  return 'pending';
}

export type ApprovalStageKey = 'SCM_MANAGER' | 'SCM_HEAD' | 'FINANCE_1' | 'FINANCE_2' | 'CEO_OFFICE';

export interface ApprovalChainEntry {
  level_number: number;
  status: 'pending' | 'approved' | 'rejected';
  stage: ApprovalStageKey;
}

interface RegistrationStatusTrackerProps {
  status: RegistrationStatus;
  className?: string;
  /**
   * Live approval chain rows for this vendor. When supplied, the tracker
   * derives per-step state (completed / active / pending / failed) directly
   * from these rows so it reflects the real-time approver. Falls back to the
   * status enum mapping when empty.
   */
  approvalProgress?: ApprovalChainEntry[];
}

// Map stage -> step index in `statusSteps`
const STAGE_TO_STEP: Record<ApprovalStageKey, number> = {
  SCM_MANAGER: 2,
  SCM_HEAD: 3,
  FINANCE_1: 4,
  FINANCE_2: 5,
  CEO_OFFICE: 5,
};

export const RegistrationStatusTracker = React.forwardRef<HTMLDivElement, RegistrationStatusTrackerProps>(
  function RegistrationStatusTracker({ status, className, approvalProgress }, ref) {
    const hasChain = (approvalProgress?.length ?? 0) > 0;

    // Build per-step override map from the live chain. Each approver step is
    // computed from its corresponding `vendor_approval_progress` row.
    const stepOverrides: Record<number, 'completed' | 'active' | 'pending' | 'failed'> = {};
    if (hasChain) {
      const sorted = [...approvalProgress!].sort((a, b) => a.level_number - b.level_number);
      const firstPending = sorted.find((r) => r.status === 'pending');
      for (const row of sorted) {
        const idx = STAGE_TO_STEP[row.stage];
        if (idx == null) continue;
        if (row.status === 'approved') {
          stepOverrides[idx] = 'completed';
        } else if (row.status === 'rejected') {
          stepOverrides[idx] = 'failed';
        } else if (row === firstPending) {
          stepOverrides[idx] = 'active';
        } else if (stepOverrides[idx] !== 'completed' && stepOverrides[idx] !== 'failed') {
          stepOverrides[idx] = 'pending';
        }
      }
      // Once any approval row exists, Document Verification is implicitly done.
      if (stepOverrides[1] === undefined) stepOverrides[1] = 'completed';

      // If all approver levels approved, SAP Sync becomes active (unless synced).
      const allApproved = sorted.length > 0 && sorted.every((r) => r.status === 'approved');
      if (allApproved && status !== 'sap_synced' && status !== 'approved') {
        stepOverrides[6] = 'active';
      }
      if (status === 'sap_synced' || status === 'approved') {
        stepOverrides[6] = 'completed';
      }
    }

    const activeStepIndex = getActiveStepIndex(status);
    const adjustedActiveIndex = status !== 'draft' ? Math.max(activeStepIndex, 0) : activeStepIndex;
    // Fill the connector up to the centre of the active step (half-segment past last completed).
    const totalSegments = statusSteps.length - 1;

    // When using the live chain, the "fill" reaches the active step (or the
    // last completed step if nothing is active yet).
    let effectiveActive = adjustedActiveIndex;
    if (hasChain) {
      const completedIndices = Object.entries(stepOverrides)
        .filter(([, v]) => v === 'completed')
        .map(([k]) => Number(k));
      const activeIdx = Object.entries(stepOverrides)
        .find(([, v]) => v === 'active')?.[0];
      const maxCompleted = completedIndices.length > 0 ? Math.max(...completedIndices) : 0;
      effectiveActive = activeIdx != null ? Number(activeIdx) : maxCompleted;
    }
    const fillRatio = effectiveActive <= 0
      ? 0
      : Math.min(1, effectiveActive / totalSegments);

    return (
      <div ref={ref} className={cn("w-full", className)}>
        <div className="relative">
          <div className="absolute top-5 left-5 right-5 h-0.5 bg-muted" />
          <div
            className="absolute top-5 left-5 h-0.5 bg-primary transition-all duration-500"
            style={{ width: `calc((100% - 40px) * ${fillRatio})` }}
          />

          <div className="relative flex justify-between">
            {statusSteps.map((step, index) => {
              const stepStatus = stepOverrides[index] ?? getStepStatus(index, adjustedActiveIndex, status);
              return (
                <div key={step.id} className="flex flex-col items-center" style={{ width: `${100 / statusSteps.length}%` }}>
                  <div
                    className={cn(
                      "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                      stepStatus === 'completed' && "bg-primary border-primary text-primary-foreground",
                      stepStatus === 'active' && "bg-primary/20 border-primary text-primary animate-pulse",
                      stepStatus === 'pending' && "bg-background border-muted text-muted-foreground",
                      stepStatus === 'failed' && "bg-destructive/20 border-destructive text-destructive"
                    )}
                  >
                    {stepStatus === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : step.icon}
                  </div>
                  <div className="mt-3 text-center">
                    <p className={cn(
                      "text-xs font-medium",
                      stepStatus === 'completed' && "text-primary",
                      stepStatus === 'active' && "text-primary",
                      stepStatus === 'pending' && "text-muted-foreground",
                      stepStatus === 'failed' && "text-destructive"
                    )}>{step.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 hidden md:block">
                      {stepStatus === 'active' ? 'In Progress' : stepStatus === 'completed' ? 'Completed' : stepStatus === 'failed' ? 'Action required' : step.description}
                    </p>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);
