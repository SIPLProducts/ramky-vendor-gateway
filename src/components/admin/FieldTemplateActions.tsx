import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { FormFieldConfig } from '@/hooks/useTenant';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  tenantId: string;
  stepKey: string;
  stepLabel: string;
  fields: FormFieldConfig[];
}

const HEADERS = [
  'field_name', 'display_label', 'field_type', 'is_mandatory', 'is_visible',
  'is_editable', 'display_order', 'placeholder', 'help_text',
  'validation_regex', 'validation_message', 'options', 'default_value',
];

const SAMPLE_ROWS = [
  {
    field_name: 'company_motto', display_label: 'Company Motto', field_type: 'text',
    is_mandatory: 'TRUE', is_visible: 'TRUE', is_editable: 'TRUE', display_order: 1,
    placeholder: 'Enter your motto', help_text: 'Optional tagline',
    validation_regex: '', validation_message: '', options: '', default_value: '',
  },
  {
    field_name: 'company_size', display_label: 'Company Size', field_type: 'select',
    is_mandatory: 'TRUE', is_visible: 'TRUE', is_editable: 'TRUE', display_order: 2,
    placeholder: 'Select size', help_text: '',
    validation_regex: '', validation_message: '',
    options: 'Small|Medium|Large', default_value: 'Medium',
  },
  {
    field_name: 'gst_number', display_label: 'GST Number', field_type: 'text',
    is_mandatory: 'TRUE', is_visible: 'TRUE', is_editable: 'TRUE', display_order: 3,
    placeholder: '22AAAAA0000A1Z5', help_text: '15-character GSTIN',
    validation_regex: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
    validation_message: 'Enter a valid GSTIN', options: '', default_value: '',
  },
];

const FIELD_TYPES = ['text', 'email', 'tel', 'number', 'date', 'textarea', 'select', 'checkbox'];

const buildWorkbook = (rows: Record<string, any>[], stepLabel: string) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS });

  // Set column widths for readability
  ws['!cols'] = [
    { wch: 22 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    { wch: 11 }, { wch: 14 }, { wch: 24 }, { wch: 28 },
    { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 18 },
  ];

  // Data validation hints (Excel dropdowns) — basic via !dataValidation
  // xlsx CE doesn't fully support data validations, so we add them as a note row at top via comments instead.
  XLSX.utils.book_append_sheet(wb, ws, 'Fields');

  // Add a Help sheet
  const help = XLSX.utils.aoa_to_sheet([
    [`Form Builder — Field Template (${stepLabel})`],
    [],
    ['Column', 'Description', 'Allowed values'],
    ['field_name', 'Internal key (snake_case, unique per tab)', 'a-z, 0-9, _'],
    ['display_label', 'Label shown to vendor', 'Free text'],
    ['field_type', 'Input type', FIELD_TYPES.join(', ')],
    ['is_mandatory', 'Required field', 'TRUE / FALSE'],
    ['is_visible', 'Show on form', 'TRUE / FALSE'],
    ['is_editable', 'Vendor can edit', 'TRUE / FALSE'],
    ['display_order', 'Sort order in tab', 'Integer (1, 2, 3...)'],
    ['placeholder', 'Placeholder text', 'Free text'],
    ['help_text', 'Helper text below input', 'Free text'],
    ['validation_regex', 'JS regex pattern', 'e.g. ^[A-Z]{5}[0-9]{4}[A-Z]$'],
    ['validation_message', 'Error message when regex fails', 'Free text'],
    ['options', 'For select / checkbox', 'Pipe-separated, e.g. Yes|No|Maybe'],
    ['default_value', 'Pre-fill value', 'Free text'],
    [],
    ['Note', 'Rows whose field_name already exists in this tab will be SKIPPED on import.'],
  ]);
  help['!cols'] = [{ wch: 20 }, { wch: 50 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, help, 'Help');

  return wb;
};

const fieldsToRows = (fields: FormFieldConfig[]): Record<string, any>[] =>
  fields.map((f, i) => ({
    field_name: f.field_name,
    display_label: f.display_label,
    field_type: f.field_type || 'text',
    is_mandatory: f.is_mandatory ? 'TRUE' : 'FALSE',
    is_visible: f.is_visible !== false ? 'TRUE' : 'FALSE',
    is_editable: f.is_editable !== false ? 'TRUE' : 'FALSE',
    display_order: f.display_order ?? i + 1,
    placeholder: f.placeholder || '',
    help_text: f.help_text || '',
    validation_regex: f.validation_regex || '',
    validation_message: f.validation_message || '',
    options: Array.isArray(f.options)
      ? f.options.map((o: any) => (typeof o === 'string' ? o : o.label || o.value)).join('|')
      : '',
    default_value: f.default_value || '',
  }));

const parseBool = (v: any) => {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
};

const parseOptions = (v: any) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s.split('|').map((label) => ({ value: label.trim(), label: label.trim() })).filter((o) => o.value);
};

export function FieldTemplateActions({ tenantId, stepKey, stepLabel, fields }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);

  const downloadTemplate = (mode: 'current' | 'blank') => {
    const rows = mode === 'current' ? fieldsToRows(fields) : SAMPLE_ROWS;
    if (mode === 'current' && rows.length === 0) {
      // Empty current → still give them headers + samples so the file isn't blank
      rows.push(...SAMPLE_ROWS);
    }
    const wb = buildWorkbook(rows, stepLabel);
    const stamp = new Date().toISOString().slice(0, 10);
    const safe = stepKey.replace(/[^a-z0-9_-]/gi, '_');
    const name = mode === 'current'
      ? `form-fields_${safe}_${stamp}.xlsx`
      : `form-fields_template_${safe}.xlsx`;
    XLSX.writeFile(wb, name);
    toast({ title: 'Template downloaded', description: name });
  };

  const handleUpload = async (file: File) => {
    setImporting(true);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets['Fields'] || wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('No sheet found in file');
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

      const existingKeys = new Set(fields.map((f) => f.field_name.toLowerCase()));
      const errors: string[] = [];
      const toInsert: any[] = [];
      let skipped = 0;
      let order = (fields[fields.length - 1]?.display_order || fields.length) + 1;

      rows.forEach((r, i) => {
        const field_name = String(r.field_name || '').trim();
        const display_label = String(r.display_label || '').trim();
        if (!field_name || !display_label) {
          errors.push(`Row ${i + 2}: missing field_name or display_label`);
          return;
        }
        if (!/^[a-z][a-z0-9_]*$/.test(field_name)) {
          errors.push(`Row ${i + 2}: invalid field_name "${field_name}" (use snake_case)`);
          return;
        }
        if (existingKeys.has(field_name.toLowerCase())) {
          skipped++;
          return;
        }
        const field_type = String(r.field_type || 'text').trim().toLowerCase();
        if (!FIELD_TYPES.includes(field_type)) {
          errors.push(`Row ${i + 2}: invalid field_type "${field_type}"`);
          return;
        }

        toInsert.push({
          tenant_id: tenantId,
          step_name: stepKey,
          field_name,
          display_label,
          field_type,
          is_mandatory: parseBool(r.is_mandatory),
          is_visible: r.is_visible === '' ? true : parseBool(r.is_visible),
          is_editable: r.is_editable === '' ? true : parseBool(r.is_editable),
          display_order: Number(r.display_order) || order++,
          placeholder: String(r.placeholder || '') || null,
          help_text: String(r.help_text || '') || null,
          validation_regex: String(r.validation_regex || '') || null,
          validation_message: String(r.validation_message || '') || null,
          options: parseOptions(r.options),
          default_value: String(r.default_value || '') || null,
        });
        existingKeys.add(field_name.toLowerCase());
      });

      if (toInsert.length > 0) {
        const { error } = await supabase.from('form_field_configs').insert(toInsert as never);
        if (error) throw error;
      }

      setResult({ inserted: toInsert.length, skipped, errors });
      qc.invalidateQueries({ queryKey: ['form-field-configs'] });
      toast({
        title: 'Import complete',
        description: `${toInsert.length} added, ${skipped} skipped${errors.length ? `, ${errors.length} errors` : ''}.`,
      });
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => downloadTemplate('current')}>
          <Download className="h-3.5 w-3.5 mr-1" /> Export Fields
        </Button>
        <Button size="sm" variant="outline" onClick={() => downloadTemplate('blank')}>
          <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Blank Template
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={importing}
        >
          <Upload className="h-3.5 w-3.5 mr-1" />
          {importing ? 'Importing…' : 'Upload .xlsx'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
      </div>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import results</DialogTitle>
            <DialogDescription>Tab: {stepLabel}</DialogDescription>
          </DialogHeader>
          {result && (
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold text-foreground">{result.inserted}</span> field(s) added.</p>
              <p><span className="font-semibold text-foreground">{result.skipped}</span> skipped (duplicate field_name).</p>
              {result.errors.length > 0 && (
                <div>
                  <p className="font-semibold text-destructive mb-1">{result.errors.length} error(s):</p>
                  <ul className="text-xs text-muted-foreground bg-muted/40 rounded p-2 max-h-48 overflow-auto list-disc list-inside space-y-0.5">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResult(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
