import * as React from 'react';
import { CheckCircle2, Clock, FileCheck, ShoppingCart, ShieldCheck, IndianRupee, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RegistrationStatus =
  | 'draft'
  | 'submitted'
  | 'validation_pending'
  | 'validation_failed'
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
    case 'scm_manager_review':
    case 'scm_manager_rejected':
    case 'purchase_review': // legacy fallback
      return 2;
    case 'scm_head_review':
    case 'scm_head_rejected':
      return 3;
    case 'finance_1_review':
    case 'finance_1_rejected':
    case 'finance_review': // legacy fallback
      return 4;
    case 'finance_2_review':
    case 'finance_2_rejected':
    case 'ceo_office_review':
    case 'ceo_office_rejected':
      return 5;
    case 'pending_sap_sync':
    case 'purchase_approved':
    case 'finance_approved':
      return 6;
    case 'sap_synced':
    case 'approved':
      return 7;
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
  scm_manager_rejected: 2,
  scm_head_rejected: 3,
  finance_1_rejected: 4,
  finance_2_rejected: 5,
  ceo_office_rejected: 5,
};

function getStepStatus(stepIndex: number, activeIndex: number, vendorStatus: RegistrationStatus): 'completed' | 'active' | 'pending' | 'failed' {
  if (FAILED_STEP[vendorStatus] === stepIndex) return 'failed';
  if (vendorStatus === 'rejected') return stepIndex < activeIndex ? 'completed' : 'pending';
  if (stepIndex < activeIndex) return 'completed';
  if (stepIndex === activeIndex) return 'active';
  return 'pending';
}

interface RegistrationStatusTrackerProps {
  status: RegistrationStatus;
  className?: string;
}

export const RegistrationStatusTracker = React.forwardRef<HTMLDivElement, RegistrationStatusTrackerProps>(
  function RegistrationStatusTracker({ status, className }, ref) {
    const activeStepIndex = getActiveStepIndex(status);
    const adjustedActiveIndex = status !== 'draft' ? Math.max(activeStepIndex, 0) : activeStepIndex;

    return (
      <div ref={ref} className={cn("w-full", className)}>
        <div className="relative">
          <div className="absolute top-5 left-5 right-5 h-0.5 bg-muted" />
          <div
            className="absolute top-5 left-5 h-0.5 bg-primary transition-all duration-500"
            style={{ width: `calc(${Math.max(0, (adjustedActiveIndex / (statusSteps.length - 1)) * 100)}% - 40px)` }}
          />
          <div className="relative flex justify-between">
            {statusSteps.map((step, index) => {
              const stepStatus = getStepStatus(index, adjustedActiveIndex, status);
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
                      {stepStatus === 'active' ? 'In Progress' : step.description}
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
