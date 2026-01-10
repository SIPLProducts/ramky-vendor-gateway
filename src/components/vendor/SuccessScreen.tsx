import React from 'react';
import { CheckCircle2, AlertCircle, Edit2, Clock, FileCheck, UserCheck, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RegistrationStatusTracker, RegistrationStatus } from './RegistrationStatusTracker';

interface SuccessScreenProps {
  status: RegistrationStatus;
  vendorId?: string;
  financeComments?: string | null;
  purchaseComments?: string | null;
  onEdit?: () => void;
}

export const SuccessScreen = React.forwardRef<HTMLDivElement, SuccessScreenProps>(({
  status,
  vendorId,
  financeComments,
  purchaseComments,
  onEdit,
}, ref) => {
  const canResubmit = status === 'validation_failed' || status === 'finance_rejected' || status === 'purchase_rejected';
  
  const getStatusConfig = () => {
    switch (status) {
      case 'validation_failed':
        return {
          icon: AlertCircle,
          iconClass: 'text-destructive',
          bgClass: 'bg-destructive/10',
          title: 'Action Required',
          message: 'Some validations failed. Please review and correct the information, then resubmit.',
        };
      case 'finance_rejected':
        return {
          icon: AlertCircle,
          iconClass: 'text-destructive',
          bgClass: 'bg-destructive/10',
          title: 'Clarification Needed',
          message: 'Your application was returned by our finance team for clarification.',
        };
      case 'purchase_rejected':
        return {
          icon: AlertCircle,
          iconClass: 'text-destructive',
          bgClass: 'bg-destructive/10',
          title: 'Clarification Needed',
          message: 'Your application was returned by our purchase team for clarification.',
        };
      case 'submitted':
      case 'validation_pending':
        return {
          icon: Clock,
          iconClass: 'text-info',
          bgClass: 'bg-info/10',
          title: 'Application Under Review',
          message: 'Your application has been submitted and is being verified. You will receive updates via email.',
        };
      case 'finance_review':
        return {
          icon: Clock,
          iconClass: 'text-info',
          bgClass: 'bg-info/10',
          title: 'Finance Review in Progress',
          message: 'Your application is being reviewed by our finance team.',
        };
      case 'finance_approved':
        return {
          icon: CheckCircle2,
          iconClass: 'text-success',
          bgClass: 'bg-success/10',
          title: 'Finance Approved',
          message: 'Your application has been approved by finance and is pending purchase approval.',
        };
      case 'purchase_review':
        return {
          icon: Clock,
          iconClass: 'text-info',
          bgClass: 'bg-info/10',
          title: 'Purchase Review in Progress',
          message: 'Your application is being reviewed by our purchase team.',
        };
      case 'purchase_approved':
        return {
          icon: CheckCircle2,
          iconClass: 'text-success',
          bgClass: 'bg-success/10',
          title: 'Approved - SAP Integration Pending',
          message: 'Your application has been fully approved. SAP vendor code will be generated shortly.',
        };
      case 'sap_synced':
        return {
          icon: CheckCircle2,
          iconClass: 'text-success',
          bgClass: 'bg-success/10',
          title: 'Registration Complete',
          message: 'Congratulations! You are now a registered vendor. Your SAP vendor code has been generated.',
        };
      default:
        return {
          icon: CheckCircle2,
          iconClass: 'text-success',
          bgClass: 'bg-success/10',
          title: 'Application Submitted Successfully',
          message: 'Thank you for registering. Your application is now under review.',
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  const nextSteps = [
    {
      icon: FileCheck,
      title: 'Document Verification',
      description: 'Your documents will be automatically verified against government databases.',
    },
    {
      icon: Building2,
      title: 'Finance Review',
      description: 'Our finance team will review your financial credentials and bank details.',
    },
    {
      icon: UserCheck,
      title: 'Purchase Approval',
      description: 'Final approval from the purchase team to complete vendor onboarding.',
    },
    {
      icon: Clock,
      title: 'SAP Integration',
      description: 'Upon approval, your vendor code will be generated in our SAP system.',
    },
  ];

  return (
    <div ref={ref} className="max-w-2xl mx-auto py-8 px-4">
      {/* Status Header */}
      <div className="text-center mb-8">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${config.bgClass} mb-4`}>
          <StatusIcon className={`h-8 w-8 ${config.iconClass}`} />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">{config.title}</h1>
        <p className="text-muted-foreground">{config.message}</p>
        
        {vendorId && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Reference Number:</span>
            <span className="text-sm font-mono font-medium text-foreground">{vendorId.slice(0, 8).toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Edit Button for Failed Status */}
      {canResubmit && onEdit && (
        <div className="flex justify-center mb-8">
          <Button onClick={onEdit} size="lg" className="gap-2">
            <Edit2 className="h-4 w-4" />
            Continue Editing Application
          </Button>
        </div>
      )}

      {/* Rejection Comments */}
      {(status === 'finance_rejected' && financeComments) && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Finance Team Comments</AlertTitle>
          <AlertDescription>{financeComments}</AlertDescription>
        </Alert>
      )}
      
      {(status === 'purchase_rejected' && purchaseComments) && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Purchase Team Comments</AlertTitle>
          <AlertDescription>{purchaseComments}</AlertDescription>
        </Alert>
      )}

      {/* Status Tracker */}
      <div className="bg-card rounded-lg border p-6 mb-6 shadow-enterprise-sm">
        <h2 className="text-base font-semibold mb-6 text-center">Application Progress</h2>
        <RegistrationStatusTracker status={status} />
      </div>

      {/* What's Next */}
      <div className="bg-card rounded-lg border p-6 shadow-enterprise-sm">
        <h3 className="text-base font-semibold mb-4">What Happens Next?</h3>
        <div className="space-y-4">
          {nextSteps.map((step, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <step.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact Support */}
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Have questions? Contact us at{' '}
          <a href="mailto:vendor.support@ramky.com" className="text-primary hover:underline">
            vendor.support@ramky.com
          </a>
        </p>
      </div>
    </div>
  );
});

SuccessScreen.displayName = 'SuccessScreen';
