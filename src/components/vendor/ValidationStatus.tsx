import { ValidationResult } from '@/types/vendor';
import { CheckCircle2, XCircle, Clock, MinusCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ValidationStatusProps {
  validations: ValidationResult[];
  isProcessing?: boolean;
}

const validationLabels: Record<string, string> = {
  gst: 'GST Verification',
  pan: 'PAN Verification',
  name_match: 'Name Match Verification',
  bank: 'Bank Account Verification (₹1 Penny Drop)',
  msme: 'MSME/Udyam Verification',
};

const statusConfig = {
  passed: {
    icon: CheckCircle2,
    className: 'text-success bg-success/10',
    label: 'Passed',
  },
  failed: {
    icon: XCircle,
    className: 'text-destructive bg-destructive/10',
    label: 'Failed',
  },
  pending: {
    icon: Clock,
    className: 'text-warning bg-warning/10',
    label: 'Pending',
  },
  skipped: {
    icon: MinusCircle,
    className: 'text-muted-foreground bg-muted',
    label: 'Skipped',
  },
};

export function ValidationStatus({ validations, isProcessing }: ValidationStatusProps) {
  const defaultValidations: ValidationResult[] = [
    { type: 'gst' as const, status: 'pending' as const, message: 'Awaiting verification' },
    { type: 'pan' as const, status: 'pending' as const, message: 'Awaiting verification' },
    { type: 'name_match' as const, status: 'pending' as const, message: 'Awaiting verification' },
    { type: 'bank' as const, status: 'pending' as const, message: 'Awaiting verification' },
    { type: 'msme' as const, status: 'pending' as const, message: 'Awaiting verification' },
  ];

  const allValidations: ValidationResult[] = defaultValidations.map((defaultVal) => {
    const found = validations.find((v) => v.type === defaultVal.type);
    return found || defaultVal;
  });

  const passedCount = validations.filter((v) => v.status === 'passed').length;
  const failedCount = validations.filter((v) => v.status === 'failed').length;

  return (
    <div className="form-section">
      <h3 className="form-section-title">Validation Status</h3>
      
      {isProcessing && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-info/10 rounded-md text-info">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Validations in progress...</span>
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{passedCount}</p>
            <p className="text-xs text-muted-foreground">Passed</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{failedCount}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {allValidations.map((validation) => {
          const config = statusConfig[validation.status];
          const Icon = config.icon;

          return (
            <div
              key={validation.type}
              className={cn(
                'flex items-center justify-between p-4 rounded-md border',
                validation.status === 'failed' && 'border-destructive/50'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn('h-10 w-10 rounded-full flex items-center justify-center', config.className)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {validationLabels[validation.type]}
                  </p>
                  <p className="text-sm text-muted-foreground">{validation.message}</p>
                </div>
              </div>
              <span className={cn('status-badge', `status-${validation.status === 'passed' ? 'success' : validation.status === 'failed' ? 'error' : validation.status === 'pending' ? 'pending' : 'info'}`)}>
                {config.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
