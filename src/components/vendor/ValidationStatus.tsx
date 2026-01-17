import { forwardRef } from 'react';
import { ValidationResult } from '@/types/vendor';
import { CheckCircle2, XCircle, Clock, MinusCircle, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ValidationStatusProps {
  validations: ValidationResult[];
  isProcessing?: boolean;
  compact?: boolean;
}

const validationLabels: Record<string, string> = {
  gst: 'GST Verification',
  pan: 'PAN Verification',
  name_match: 'Name Match Verification',
  bank: 'Bank Account Verification',
  msme: 'MSME/Udyam Verification',
};

const statusConfig = {
  passed: {
    icon: CheckCircle2,
    className: 'text-success bg-success/10 border-success/30',
    badgeClass: 'bg-success/15 text-success border-success/30',
    label: 'Pass',
  },
  failed: {
    icon: XCircle,
    className: 'text-destructive bg-destructive/10 border-destructive/30',
    badgeClass: 'bg-destructive/15 text-destructive border-destructive/30',
    label: 'Fail',
  },
  pending: {
    icon: Clock,
    className: 'text-warning bg-warning/10 border-warning/30',
    badgeClass: 'bg-warning/15 text-warning border-warning/30',
    label: 'Pending',
  },
  skipped: {
    icon: MinusCircle,
    className: 'text-muted-foreground bg-muted border-muted-foreground/20',
    badgeClass: 'bg-muted text-muted-foreground border-muted-foreground/20',
    label: 'Skipped',
  },
  exception: {
    icon: AlertTriangle,
    className: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
    badgeClass: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
    label: 'Exception',
  },
};

export const ValidationStatus = forwardRef<HTMLDivElement, ValidationStatusProps>(
  ({ validations, isProcessing, compact = false }, ref) => {
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
    const skippedCount = validations.filter((v) => v.status === 'skipped').length;
    const pendingCount = allValidations.filter((v) => v.status === 'pending').length;

    return (
      <div ref={ref} className="form-section">
        <h3 className="form-section-title">Validation Status</h3>
        
        {isProcessing && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-primary/10 rounded-md border border-primary/30">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-medium text-primary">Validations in progress...</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
            <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success">{passedCount}</p>
              <p className="text-xs text-muted-foreground">Passed</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{failedCount}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-muted-foreground/20">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <MinusCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{skippedCount}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
            <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-warning">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
        </div>

        {/* Validation Items */}
        <div className="space-y-3">
          {allValidations.map((validation) => {
            const config = statusConfig[validation.status] || statusConfig.pending;
            const Icon = config.icon;

            return (
              <div
                key={validation.type}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border transition-all',
                  validation.status === 'failed' && 'border-destructive/50 bg-destructive/5',
                  validation.status === 'passed' && 'border-success/50 bg-success/5',
                  validation.status === 'pending' && 'border-border bg-card'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('h-10 w-10 rounded-full flex items-center justify-center border', config.className)}>
                    {isProcessing && validation.status === 'pending' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {validationLabels[validation.type]}
                    </p>
                    <p className="text-sm text-muted-foreground">{validation.message}</p>
                  </div>
                </div>
                <Badge variant="outline" className={cn('font-semibold', config.badgeClass)}>
                  {config.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

ValidationStatus.displayName = 'ValidationStatus';
