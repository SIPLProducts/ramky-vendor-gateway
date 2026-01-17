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
  const isIdle = state.status === 'idle';

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'gap-2 min-w-[100px] transition-all border-2',
        isIdle && 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400',
        isPassed && 'border-green-500 bg-green-50 text-green-700 hover:bg-green-100',
        isFailed && 'border-red-500 bg-red-100 text-red-700 hover:bg-red-200',
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
