import { useMemo } from 'react';
import type { FormFieldConfig } from '@/hooks/useTenant';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';

interface DynamicStepProps {
  stepKey: string;
  fields: FormFieldConfig[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

/**
 * Generic renderer for an admin-defined tab. Writes values into a single
 * { [stepKey]: { [fieldName]: value } } shape on the parent form state.
 */
export function DynamicStep({ stepKey, fields, values, onChange }: DynamicStepProps) {
  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.display_order - b.display_order),
    [fields],
  );

  const setField = (name: string, value: unknown) => {
    onChange({ ...values, [name]: value });
  };

  const validate = (field: FormFieldConfig, value: unknown): string | null => {
    if (field.is_mandatory && (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0))) {
      return 'This field is required';
    }
    if (field.validation_regex && typeof value === 'string' && value) {
      try {
        const re = new RegExp(field.validation_regex);
        if (!re.test(value)) return field.validation_message || 'Invalid format';
      } catch {
        // ignore bad regex
      }
    }
    return null;
  };

  if (sortedFields.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No fields configured for this tab yet.
      </div>
    );
  }

  return (
    <form id="step-form" onSubmit={(e) => e.preventDefault()} className="space-y-5">
      {sortedFields.map((f) => {
        const value = values?.[f.field_name] ?? f.default_value ?? '';
        const error = validate(f, value);
        const inputId = `${stepKey}-${f.field_name}`;

        return (
          <div key={f.id} className="space-y-1.5">
            <Label htmlFor={inputId} className="text-sm">
              {f.display_label}
              {f.is_mandatory && <span className="text-destructive ml-1">*</span>}
            </Label>

            {renderInput(f, inputId, value, setField)}

            {f.help_text && (
              <p className="text-xs text-muted-foreground">{f.help_text}</p>
            )}
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        );
      })}
    </form>
  );
}

function renderInput(
  f: FormFieldConfig,
  id: string,
  value: unknown,
  setField: (name: string, value: unknown) => void,
) {
  const disabled = f.is_editable === false;
  const opts = (f.options || []).map((o) => ({ value: String(o.value), label: o.label }));

  switch (f.field_type) {
    case 'textarea':
      return (
        <Textarea
          id={id}
          value={(value as string) || ''}
          placeholder={f.placeholder || ''}
          disabled={disabled}
          onChange={(e) => setField(f.field_name, e.target.value)}
          rows={3}
        />
      );
    case 'number':
      return (
        <Input
          id={id}
          type="number"
          value={(value as string) || ''}
          placeholder={f.placeholder || ''}
          disabled={disabled}
          onChange={(e) => setField(f.field_name, e.target.value)}
        />
      );
    case 'email':
      return (
        <Input id={id} type="email" value={(value as string) || ''} placeholder={f.placeholder || ''} disabled={disabled}
          onChange={(e) => setField(f.field_name, e.target.value)} />
      );
    case 'phone':
      return (
        <Input id={id} type="tel" value={(value as string) || ''} placeholder={f.placeholder || ''} disabled={disabled}
          onChange={(e) => setField(f.field_name, e.target.value)} />
      );
    case 'date':
      return (
        <Input id={id} type="date" value={(value as string) || ''} disabled={disabled}
          onChange={(e) => setField(f.field_name, e.target.value)} />
      );
    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <Checkbox id={id} checked={!!value} disabled={disabled}
            onCheckedChange={(c) => setField(f.field_name, !!c)} />
          <Label htmlFor={id} className="text-sm font-normal text-muted-foreground">{f.placeholder || 'Yes'}</Label>
        </div>
      );
    case 'select':
      return (
        <Select value={(value as string) || ''} disabled={disabled}
          onValueChange={(v) => setField(f.field_name, v)}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={f.placeholder || 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {opts.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'multi-select':
    case 'multiselect':
      return (
        <MultiSelect
          options={opts}
          selected={Array.isArray(value) ? (value as string[]) : []}
          onChange={(vals) => setField(f.field_name, vals)}
          placeholder={f.placeholder || 'Select...'}
        />
      );
    case 'file':
      return (
        <Input id={id} type="file" disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Files can't survive JSON serialization — store filename only
            // (file upload for custom fields is out of scope for this pass)
            setField(f.field_name, file?.name || '');
          }} />
      );
    case 'text':
    default:
      return (
        <Input id={id} type="text" value={(value as string) || ''} placeholder={f.placeholder || ''} disabled={disabled}
          onChange={(e) => setField(f.field_name, e.target.value)} />
      );
  }
}
