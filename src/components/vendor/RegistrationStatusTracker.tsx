import * as React from 'react';
import { CheckCircle2, Clock, FileCheck, Building2, ShoppingCart, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
export type RegistrationStatus = 
  | 'draft'
  | 'submitted'
  | 'validation_pending'
  | 'validation_failed'
  | 'finance_review'
  | 'finance_approved'
  | 'finance_rejected'
  | 'purchase_review'
  | 'purchase_approved'
  | 'purchase_rejected'
  | 'sap_synced'
  | 'approved'
  | 'rejected';

interface StatusStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const statusSteps: StatusStep[] = [
  {
    id: 'submitted',
    label: 'Submitted',
    description: 'Registration received',
    icon: <FileCheck className="h-5 w-5" />,
  },
  {
    id: 'verification',
    label: 'Document Verification',
    description: 'Validating your documents',
    icon: <Clock className="h-5 w-5" />,
  },
  {
    id: 'finance',
    label: 'Finance Review',
    description: 'Under finance team review',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    id: 'purchase',
    label: 'Purchase Approval',
    description: 'Awaiting purchase approval',
    icon: <ShoppingCart className="h-5 w-5" />,
  },
  {
    id: 'completed',
    label: 'SAP Sync',
    description: 'Vendor code created',
    icon: <Server className="h-5 w-5" />,
  },
];

function getActiveStepIndex(status: RegistrationStatus): number {
  switch (status) {
    case 'draft':
      return -1;
    case 'submitted':
    case 'validation_pending':
      return 1; // Verification in progress
    case 'validation_failed':
      return 1; // Stuck at verification
    case 'finance_review':
      return 2; // Finance review in progress
    case 'finance_rejected':
      return 2; // Stuck at finance
    case 'finance_approved':
    case 'purchase_review':
      return 3; // Purchase review in progress
    case 'purchase_rejected':
      return 3; // Stuck at purchase
    case 'purchase_approved':
      return 4; // SAP sync in progress
    case 'sap_synced':
    case 'approved':
      return 5; // All steps completed (beyond last step)
    case 'rejected':
      return -2; // Special case for rejection
    default:
      return 0;
  }
}

function getStepStatus(stepIndex: number, activeIndex: number, vendorStatus: RegistrationStatus): 'completed' | 'active' | 'pending' | 'failed' {
  if (vendorStatus === 'validation_failed' && stepIndex === 1) {
    return 'failed';
  }
  if (vendorStatus === 'finance_rejected' && stepIndex === 2) {
    return 'failed';
  }
  if (vendorStatus === 'purchase_rejected' && stepIndex === 3) {
    return 'failed';
  }
  if (vendorStatus === 'rejected') {
    return stepIndex < activeIndex ? 'completed' : 'pending';
  }
  if (stepIndex < activeIndex) {
    return 'completed';
  }
  if (stepIndex === activeIndex) {
    return 'active';
  }
  return 'pending';
}

interface RegistrationStatusTrackerProps {
  status: RegistrationStatus;
  className?: string;
}

export const RegistrationStatusTracker = React.forwardRef<HTMLDivElement, RegistrationStatusTrackerProps>(
  function RegistrationStatusTracker({ status, className }, ref) {
    const activeStepIndex = getActiveStepIndex(status);

    // Always show submitted as completed once form is submitted
    const adjustedActiveIndex = status !== 'draft' ? Math.max(activeStepIndex, 0) : activeStepIndex;

    return (
      <div ref={ref} className={cn("w-full", className)}>
        <div className="relative">
          {/* Progress line */}
          <div className="absolute top-5 left-5 right-5 h-0.5 bg-muted" />
          <div 
            className="absolute top-5 left-5 h-0.5 bg-primary transition-all duration-500"
            style={{ 
              width: `calc(${Math.max(0, (adjustedActiveIndex / (statusSteps.length - 1)) * 100)}% - 40px)` 
            }}
          />

          {/* Steps */}
          <div className="relative flex justify-between">
            {statusSteps.map((step, index) => {
              const stepStatus = getStepStatus(index, adjustedActiveIndex, status);
              
              return (
                <div key={step.id} className="flex flex-col items-center" style={{ width: '20%' }}>
                  <div
                    className={cn(
                      "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                      stepStatus === 'completed' && "bg-primary border-primary text-primary-foreground",
                      stepStatus === 'active' && "bg-primary/20 border-primary text-primary animate-pulse",
                      stepStatus === 'pending' && "bg-background border-muted text-muted-foreground",
                      stepStatus === 'failed' && "bg-destructive/20 border-destructive text-destructive"
                    )}
                  >
                    {stepStatus === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      step.icon
                    )}
                  </div>
                  <div className="mt-3 text-center">
                    <p
                      className={cn(
                        "text-xs font-medium",
                        stepStatus === 'completed' && "text-primary",
                        stepStatus === 'active' && "text-primary",
                        stepStatus === 'pending' && "text-muted-foreground",
                        stepStatus === 'failed' && "text-destructive"
                      )}
                    >
                      {step.label}
                    </p>
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
