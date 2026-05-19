import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Award } from 'lucide-react';
import { InternationalClassification } from '@/types/vendor';
import { useSapMasterData, SapMasterRow } from '@/hooks/useSapMasterData';

const schema = z.object({
  materialGroupVendor: z.array(z.string()).min(1, 'Material Group for Vendors is required'),
  vendorLocation: z.array(z.string()).min(1, 'Vendor Location is required'),
  vendorCategory: z.array(z.string()).optional().default([]),
  identificationSource: z.array(z.string()).optional().default([]),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  data: InternationalClassification;
  onSubmit: (data: InternationalClassification) => void;
  onLiveUpdate?: (data: InternationalClassification) => void;
}

const sapOptions = (rows: SapMasterRow[] | undefined) =>
  (rows || []).map((r) => ({ value: r.code, label: r.description ? `${r.code} — ${r.description}` : r.code }));

const asArr = (v: unknown): string[] =>
  Array.isArray(v) ? (v as string[]) : (v ? [String(v)] : []);

export function IntlClassificationStep({ data, onSubmit, onLiveUpdate }: Props) {
  const { data: sapMatGrp } = useSapMasterData('material_group_vendor');
  const { data: sapVendorCat } = useSapMasterData('vendor_category');
  const { data: sapVendorLoc } = useSapMasterData('vendor_location');
  const { data: sapIdSource } = useSapMasterData('identification_source');

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      materialGroupVendor: asArr(data.materialGroupVendor),
      vendorLocation: asArr(data.vendorLocation),
      vendorCategory: asArr(data.vendorCategory),
      identificationSource: asArr(data.identificationSource),
    },
  });

  useEffect(() => {
    const sub = watch((vals) => {
      const v = vals as FormValues;
      onLiveUpdate?.({
        materialGroupVendor: v.materialGroupVendor || [],
        vendorCategory: v.vendorCategory || [],
        vendorLocation: v.vendorLocation || [],
        identificationSource: v.identificationSource || [],
      });
    });
    return () => sub.unsubscribe();
  }, [watch, onLiveUpdate]);

  const handleFormSubmit = (v: FormValues) => {
    onSubmit({
      materialGroupVendor: v.materialGroupVendor || [],
      vendorCategory: v.vendorCategory || [],
      vendorLocation: v.vendorLocation || [],
      identificationSource: v.identificationSource || [],
    });
  };

  const renderField = (
    name: keyof FormValues,
    label: string,
    required: boolean,
    rows: SapMasterRow[] | undefined,
    placeholderEmpty: string,
    placeholderFull: string,
  ) => (
    <div className="grid gap-1.5">
      <Label>
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <MultiSelect
            options={sapOptions(rows)}
            selected={(field.value as string[]) || []}
            onChange={field.onChange}
            placeholder={rows && rows.length ? placeholderFull : placeholderEmpty}
            className={errors[name] ? 'border-destructive' : ''}
          />
        )}
      />
      {errors[name] && <p className="text-xs text-destructive">{(errors[name] as any)?.message as string}</p>}
      {(!rows || rows.length === 0) && (
        <p className="text-xs text-muted-foreground">No SAP values — sync SAP master data.</p>
      )}
    </div>
  );

  return (
    <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">
          <Award className="h-5 w-5 text-primary" />
          Classification
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Values are sourced from SAP master data.
        </p>

        <div className="grid md:grid-cols-2 gap-5">
          {renderField('materialGroupVendor', 'Material Group for Vendors', true, sapMatGrp, 'No SAP values — sync SAP master data', 'Select material groups')}
          {renderField('vendorLocation', 'Vendor Location', true, sapVendorLoc, 'No SAP values — sync SAP master data', 'Select locations')}
          {renderField('vendorCategory', 'Vendor Category', false, sapVendorCat, 'No SAP values — sync SAP master data', 'Select vendor categories')}
          {renderField('identificationSource', 'Vendor Identification Source', false, sapIdSource, 'No SAP values — sync SAP master data', 'Select identification sources')}
        </div>
      </div>
    </form>
  );
}
