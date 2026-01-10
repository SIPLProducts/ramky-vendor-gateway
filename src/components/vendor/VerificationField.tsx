import { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldValidationState } from '@/hooks/useFieldValidation';

interface VerificationFieldProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  validationState: FieldValidationState;
  onVerify: () => void;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  children?: ReactNode;
}

export function VerificationField({
  id,
  label,
  placeholder,
  value,
  onChange,
  validationState,
  onVerify,
  disabled = false,
  maxLength,
  className,
  helperText,
  error,
  required = false,
  children,
}: VerificationFieldProps) {
  const isLoading = validationState.status === 'validating';
  const isPassed = validationState.status === 'passed';
  const isFailed = validationState.status === 'failed';
  const isReadOnly = isPassed;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
        {isPassed && <Lock className="h-3 w-3 text-muted-foreground ml-1" />}
      </Label>
      
      <div className="flex gap-2">
        {children || (
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            placeholder={placeholder}
            maxLength={maxLength}
            disabled={isReadOnly}
            className={cn(
              "flex-1 uppercase font-mono",
              error && "border-destructive",
              isPassed && "bg-success/5 border-success/30",
              isFailed && "border-destructive"
            )}
          />
        )}
        
        <Button
          type="button"
          variant={isPassed ? 'default' : isFailed ? 'destructive' : 'outline'}
          size="default"
          onClick={onVerify}
          disabled={disabled || isLoading || isReadOnly}
          className={cn(
            'gap-2 min-w-[120px] transition-all shrink-0',
            isPassed && 'bg-success hover:bg-success/90 text-success-foreground'
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
      </div>

      {/* Validation Message */}
      {validationState.message && (
        <p className={cn(
          "text-xs flex items-center gap-1",
          isPassed && "text-success",
          isFailed && "text-destructive",
          isLoading && "text-muted-foreground"
        )}>
          {isPassed && <CheckCircle2 className="h-3 w-3" />}
          {isFailed && <XCircle className="h-3 w-3" />}
          {validationState.message}
        </p>
      )}

      {/* Error from form validation */}
      {error && !validationState.message && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Helper text */}
      {helperText && !validationState.message && !error && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}

      {/* Fetched data display */}
      {isPassed && validationState.data && (
        <div className="mt-2 p-3 bg-success/5 rounded-md border border-success/20">
          <p className="text-xs font-medium text-success mb-1">Verified Details:</p>
          <div className="grid gap-1 text-xs text-muted-foreground">
            {Object.entries(validationState.data).map(([key, val]) => (
              val && typeof val === 'string' && (
                <div key={key} className="flex gap-2">
                  <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                  <span className="font-medium text-foreground">{val}</span>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
