import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldValidationState } from '@/hooks/useFieldValidation';

interface ValidationMessageProps {
  state: FieldValidationState;
  className?: string;
}

export function ValidationMessage({ state, className }: ValidationMessageProps) {
  if (state.status === 'idle' || !state.message) return null;

  const isLoading = state.status === 'validating';
  const isPassed = state.status === 'passed';
  const isFailed = state.status === 'failed';

  return (
    <div
      className={cn(
        'flex items-start gap-2 p-3 rounded-md text-sm mt-2 transition-all',
        isLoading && 'bg-primary/10 text-primary border border-primary/20',
        isPassed && 'bg-success/10 text-success border border-success/20',
        isFailed && 'bg-destructive/10 text-destructive border border-destructive/20',
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin mt-0.5 shrink-0" />
      ) : isPassed ? (
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
      ) : isFailed ? (
        <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      )}
      <span>{state.message}</span>
    </div>
  );
}
