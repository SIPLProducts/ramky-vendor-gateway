import { CheckCircle2, AlertCircle, Edit2, Clock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RegistrationStatusTracker, RegistrationStatus } from './RegistrationStatusTracker';
import { useVendorApprovalChain } from '@/hooks/useVendorApprovalChain';

interface SuccessScreenProps {
  status: RegistrationStatus;
  vendorId?: string;
  referenceNumber?: string | null;
  financeComments?: string | null;
  purchaseComments?: string | null;
  onEdit?: () => void;
  onBack?: () => void;
  backLabel?: string;
}

export function SuccessScreen({
  status,
  vendorId,
  referenceNumber,
  financeComments,
  purchaseComments,
  onEdit,
  onBack,
  backLabel = 'Back to Applications',
}: SuccessScreenProps) {
  const { rows: approvalChain } = useVendorApprovalChain(vendorId);
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
          message: 'Thank you for submitting your application.',
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;


  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {onBack && (
        <div className="mb-4">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
        </div>
      )}
      {/* Status Header */}
      <div className="text-center mb-8">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${config.bgClass} mb-4`}>
          <StatusIcon className={`h-8 w-8 ${config.iconClass}`} />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">{config.title}</h1>
        <p className="text-muted-foreground">{config.message}</p>
        
        {(referenceNumber || vendorId) && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Reference Number:</span>
            <span className="text-sm font-mono font-medium text-foreground">{referenceNumber || (vendorId ? vendorId.slice(0, 8).toUpperCase() : '')}</span>
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

      {/* Application Progress diagram intentionally hidden for vendors post-submission. */}




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
}