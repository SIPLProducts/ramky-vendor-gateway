import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useUpsertFormField } from '@/hooks/useFormBuilder';
import type { FormFieldConfig } from '@/hooks/useTenant';
import { cn } from '@/lib/utils';

interface Props {
  tenantId: string;
  stepKey: string;
  field?: FormFieldConfig | null;
  defaultOrder?: number;
  onClose: () => void;
  /** When true, this is editing a built-in field override.
   *  - field_name & field_type are locked
   *  - default_value is forced to BUILTIN_OVERRIDE_MARK so the row stays
   *    classified as a built-in override.
   *  - When `field` is null we expect `builtInDefaults` to seed the form. */
  builtInMode?: boolean;
  builtInDefaults?: {
    field_name: string;
    display_label: string;
    field_type: string;
    is_mandatory: boolean;
    placeholder?: string;
    help_text?: string;
  };
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (single)' },
  { value: 'multi-select', label: 'Select (multiple)' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'file', label: 'File upload' },
];

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const BUILTIN_OVERRIDE_MARK = '__builtin_override__';

export function InlineFieldEditor({ tenantId, stepKey, field, defaultOrder = 1, onClose, builtInMode, builtInDefaults }: Props) {
  const upsert = useUpsertFormField();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    field_name: '',
    display_label: '',
    field_type: 'text',
    placeholder: '',
    help_text: '',
    default_value: '',
    is_mandatory: false,
    is_visible: true,
    is_editable: true,
    validation_regex: '',
    validation_message: '',
    display_order: defaultOrder,
    options: [] as Array<{ value: string; label: string }>,
  });

  useEffect(() => {
    if (field) {
      setForm({
        field_name: field.field_name,
        display_label: field.display_label,
        field_type: field.field_type,
        placeholder: field.placeholder || builtInDefaults?.placeholder || '',
        help_text: field.help_text || builtInDefaults?.help_text || '',
        default_value: field.default_value || '',
        is_mandatory: !!field.is_mandatory,
        is_visible: !!field.is_visible,
        is_editable: !!field.is_editable,
        validation_regex: field.validation_regex || '',
        validation_message: field.validation_message || '',
        display_order: field.display_order || 1,
        options: field.options || [],
      });
      // Auto-open advanced when there's content worth showing
      if (field.help_text || field.validation_regex || field.default_value) {
        setShowAdvanced(true);
      }
    } else if (builtInMode && builtInDefaults) {
      setForm({
        field_name: builtInDefaults.field_name,
        display_label: builtInDefaults.display_label,
        field_type: builtInDefaults.field_type,
        placeholder: builtInDefaults.placeholder || '',
        help_text: builtInDefaults.help_text || '',
        default_value: '',
        is_mandatory: builtInDefaults.is_mandatory,
        is_visible: true, is_editable: true,
        validation_regex: '', validation_message: '',
        display_order: defaultOrder, options: [],
      });
      if (builtInDefaults.help_text) setShowAdvanced(true);
    } else {
      setForm({
        field_name: '', display_label: '', field_type: 'text',
        placeholder: '', help_text: '', default_value: '',
        is_mandatory: false, is_visible: true, is_editable: true,
        validation_regex: '', validation_message: '',
        display_order: defaultOrder, options: [],
      });
    }
    // Depend on PRIMITIVE values so a fresh `builtInDefaults` object literal
    // on every render of the parent doesn't keep resetting the form (which
    // would wipe whatever the admin is typing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    field?.id,
    defaultOrder,
    builtInMode,
    builtInDefaults?.field_name,
    builtInDefaults?.display_label,
    builtInDefaults?.field_type,
    builtInDefaults?.is_mandatory,
    builtInDefaults?.placeholder,
    builtInDefaults?.help_text,
  ]);

  const needsOptions = form.field_type === 'select' || form.field_type === 'multi-select';

  const handleSave = async () => {
    if (!form.display_label.trim()) return;
    const fieldName = form.field_name.trim() || slugify(form.display_label);
    await upsert.mutateAsync({
      id: field?.id,
      tenant_id: tenantId,
      step_name: stepKey,
      field_name: fieldName,
      display_label: form.display_label,
      field_type: form.field_type,
      placeholder: form.placeholder || null,
      help_text: form.help_text || null,
      default_value: builtInMode ? BUILTIN_OVERRIDE_MARK : (form.default_value || null),
      is_mandatory: form.is_mandatory,
      is_visible: form.is_visible,
      is_editable: form.is_editable,
      validation_regex: form.validation_regex || null,
      validation_message: form.validation_message || null,
      display_order: Number(form.display_order) || 1,
      options: needsOptions ? form.options : null,
    });
    onClose();
  };

  return (
    <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
      {builtInMode && (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground/80">
          Editing built-in field — <span className="font-mono">{form.field_name}</span> and type are locked.
          Saving stores an override for this tenant only.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        <div className="space-y-1.5">
          <Label className="text-xs">Display Label *</Label>
          <Input
            autoFocus
            value={form.display_label}
            onChange={(e) => setForm({ ...form, display_label: e.target.value })}
            placeholder="e.g. ISO 9001 Certificate Number"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Field Key{builtInMode && ' (locked)'}</Label>
          <Input
            value={form.field_name}
            onChange={(e) => setForm({ ...form, field_name: e.target.value })}
            placeholder={form.display_label ? slugify(form.display_label) : 'iso_9001_cert_no'}
            disabled={!!field || builtInMode}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Type{builtInMode && ' (locked)'}</Label>
          <Select value={form.field_type} onValueChange={(v) => setForm({ ...form, field_type: v })} disabled={builtInMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs">Placeholder</Label>
          <Input value={form.placeholder} onChange={(e) => setForm({ ...form, placeholder: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Order</Label>
          <Input type="number" value={form.display_order}
            onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 1 })} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center justify-between rounded-md border p-2 bg-background">
          <Label className="text-xs">Visible</Label>
          <Switch checked={form.is_visible} onCheckedChange={(v) => setForm({ ...form, is_visible: v })} />
        </div>
        <div className="flex items-center justify-between rounded-md border p-2 bg-background">
          <Label className="text-xs">Required</Label>
          <Switch checked={form.is_mandatory} onCheckedChange={(v) => setForm({ ...form, is_mandatory: v })} />
        </div>
        <div className="flex items-center justify-between rounded-md border p-2 bg-background">
          <Label className="text-xs">Editable</Label>
          <Switch checked={form.is_editable} onCheckedChange={(v) => setForm({ ...form, is_editable: v })} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {showAdvanced ? 'Hide advanced' : 'Show advanced'}
      </button>

      {showAdvanced && (
        <div className="space-y-3 pt-2 border-t">
          <div className="space-y-1.5">
            <Label className="text-xs">Help Text</Label>
            <Textarea rows={2} value={form.help_text} onChange={(e) => setForm({ ...form, help_text: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Default Value</Label>
            <Input value={form.default_value} onChange={(e) => setForm({ ...form, default_value: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Validation Regex</Label>
              <Input value={form.validation_regex}
                onChange={(e) => setForm({ ...form, validation_regex: e.target.value })}
                placeholder="^[A-Z]{3}-\d{4}$" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Validation Message</Label>
              <Input value={form.validation_message}
                onChange={(e) => setForm({ ...form, validation_message: e.target.value })}
                placeholder="Invalid format" />
            </div>
          </div>

          {needsOptions && (
            <div className="space-y-2 border rounded-lg p-3 bg-background">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Options</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, options: [...form.options, { value: '', label: '' }] })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
              {form.options.length === 0 && <p className="text-xs text-muted-foreground">No options yet.</p>}
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input placeholder="Label" value={opt.label}
                    onChange={(e) => {
                      const next = [...form.options];
                      next[i] = { value: next[i].value || slugify(e.target.value), label: e.target.value };
                      setForm({ ...form, options: next });
                    }} />
                  <Input placeholder="value" value={opt.value}
                    onChange={(e) => {
                      const next = [...form.options];
                      next[i] = { ...next[i], value: e.target.value };
                      setForm({ ...form, options: next });
                    }} />
                  <Button type="button" variant="ghost" size="icon"
                    onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={upsert.isPending || !form.display_label.trim()}>
          {upsert.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {builtInMode ? 'Save Override' : (field ? 'Save Changes' : 'Add Field')}
        </Button>
      </div>
    </div>
  );
}
