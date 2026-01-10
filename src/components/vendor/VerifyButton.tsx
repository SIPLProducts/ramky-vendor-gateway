import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldValidationState } from '@/hooks/useFieldValidation';

interface VerifyButtonProps {
  onClick: () => void;
  state: FieldValidationState;
  disabled?: boolean;
  className?: string;
}

export function VerifyButton({ onClick, state, disabled, className }: VerifyButtonProps) {
  const isLoading = state.status === 'validating';
  const isPassed = state.status === 'passed';
  const isFailed = state.status === 'failed';

  return (
    <Button
      type="button"
      variant={isPassed ? 'default' : isFailed ? 'destructive' : 'outline'}
      size="sm"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'gap-2 min-w-[100px] transition-all',
        isPassed && 'bg-success hover:bg-success/90 text-success-foreground',
        className
      )}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Verifying...
        </>
      ) : isPassed ? (
        <>
          <CheckCircle2 className="h-4 w-4" />
          Verified
        </>
      ) : isFailed ? (
        <>
          <XCircle className="h-4 w-4" />
          Retry
        </>
      ) : (
        <>
          <ShieldCheck className="h-4 w-4" />
          Verify
        </>
      )}
    </Button>
  );
}
