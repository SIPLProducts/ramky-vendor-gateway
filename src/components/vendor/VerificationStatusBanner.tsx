import { CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldValidationState } from '@/hooks/useFieldValidation';

interface VerificationStatusBannerProps {
  validationStates: {
    gst: FieldValidationState;
    pan: FieldValidationState;
    bank: FieldValidationState;
    msme: FieldValidationState;
  };
}

export function VerificationStatusBanner({ validationStates }: VerificationStatusBannerProps) {
  const verifications = [
    { key: 'gst', label: 'GST', state: validationStates.gst },
    { key: 'pan', label: 'PAN', state: validationStates.pan },
    { key: 'bank', label: 'Bank', state: validationStates.bank },
    { key: 'msme', label: 'MSME', state: validationStates.msme },
  ];

  const completedCount = verifications.filter(v => v.state.status === 'passed').length;
  const allCompleted = completedCount === verifications.length;
  const hasFailures = verifications.some(v => v.state.status === 'failed');

  return (
    <div className={cn(
      "rounded-lg border p-4 mb-6 transition-all",
      allCompleted && "bg-success/5 border-success/30",
      hasFailures && !allCompleted && "bg-destructive/5 border-destructive/30",
      !allCompleted && !hasFailures && "bg-muted border-border"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full",
            allCompleted && "bg-success/10",
            hasFailures && !allCompleted && "bg-destructive/10",
            !allCompleted && !hasFailures && "bg-muted"
          )}>
            {allCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : hasFailures ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Shield className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm">
              {allCompleted 
                ? 'All Verifications Completed' 
                : `${completedCount} of ${verifications.length} verifications completed`}
            </p>
            <p className="text-xs text-muted-foreground">
              {allCompleted 
                ? 'You can now proceed to the next step' 
                : 'Complete all mandatory verifications to continue'}
            </p>
          </div>
        </div>
        
        <div className="hidden sm:flex items-center gap-2">
          {verifications.map((v) => (
            <div
              key={v.key}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                v.state.status === 'passed' && "bg-success/10 text-success",
                v.state.status === 'failed' && "bg-destructive/10 text-destructive",
                v.state.status === 'validating' && "bg-primary/10 text-primary animate-pulse",
                v.state.status === 'idle' && "bg-muted text-muted-foreground"
              )}
            >
              {v.state.status === 'passed' && <CheckCircle2 className="h-3 w-3" />}
              {v.state.status === 'failed' && <AlertCircle className="h-3 w-3" />}
              {v.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
