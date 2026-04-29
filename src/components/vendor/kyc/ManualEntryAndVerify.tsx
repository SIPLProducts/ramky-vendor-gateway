import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VerifyButton } from '@/components/vendor/VerifyButton';
import { ValidationMessage } from '@/components/vendor/ValidationMessage';
import { FieldValidationState } from '@/hooks/useFieldValidation';
import { cn } from '@/lib/utils';

interface ManualEntryAndVerifyProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  onVerify: () => void;
  state: FieldValidationState;
  maxLength?: number;
  uppercase?: boolean;
  helperText?: string;
  canVerify?: boolean;
}

export function ManualEntryAndVerify({
  id,
  label,
  placeholder,
  value,
  onChange,
  onVerify,
  state,
  maxLength,
  uppercase = true,
  helperText,
  canVerify = true,
}: ManualEntryAndVerifyProps) {
  const isLocked = state.status === 'passed';
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={isLocked}
          className={cn('flex-1', uppercase && 'uppercase font-mono', isLocked && 'bg-success/5 border-success/30')}
        />
        <VerifyButton onClick={onVerify} state={state} disabled={!canVerify || isLocked} />
      </div>
      {helperText && state.status === 'idle' && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
      <ValidationMessage state={state} />
    </div>
  );
}
