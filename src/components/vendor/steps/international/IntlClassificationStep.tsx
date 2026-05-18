import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Award } from 'lucide-react';
import {
  InternationalClassification,
  PRODUCT_CATEGORIES,
  VENDOR_CATEGORIES,
  IDENTIFICATION_SOURCES,
} from '@/types/vendor';

const schema = z.object({
  materialGroupVendor: z.array(z.string()).min(1, 'Material Group for Vendors is required'),
  vendorCategory: z.array(z.string()).min(1, 'Vendor Category is required'),
  vendorLocation: z.array(z.string()).min(1, 'Vendor Location is required'),
  identificationSource: z.array(z.string()).min(1, 'Identification Source is required'),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  data: InternationalClassification;
  onSubmit: (data: InternationalClassification) => void;
  onLiveUpdate?: (data: InternationalClassification) => void;
}

export function IntlClassificationStep({ data, onSubmit, onLiveUpdate }: Props) {
  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: data,
  });

  useEffect(() => {
    const sub = watch((vals) => onLiveUpdate?.(vals as InternationalClassification));
    return () => sub.unsubscribe();
  }, [watch, onLiveUpdate]);

  return (
    <form id="step-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">
          <Award className="h-5 w-5 text-primary" />
          Classification
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          All fields below are required — manual entry, applies to international vendors.
        </p>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="grid gap-1.5">
            <Label>Material Group for Vendors *</Label>
            <Controller
              name="materialGroupVendor"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={PRODUCT_CATEGORIES.map((c) => ({ label: c.toUpperCase(), value: c }))}
                  selected={field.value || []}
                  onChange={field.onChange}
                  placeholder="Select material groups"
                  className={errors.materialGroupVendor ? 'border-destructive' : ''}
                />
              )}
            />
            {errors.materialGroupVendor && (
              <p className="text-xs text-destructive">{errors.materialGroupVendor.message as string}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Vendor Category *</Label>
            <Controller
              name="vendorCategory"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={VENDOR_CATEGORIES.map((c) => ({ label: c, value: c }))}
                  selected={field.value || []}
                  onChange={field.onChange}
                  placeholder="Select vendor categories"
                  className={errors.vendorCategory ? 'border-destructive' : ''}
                />
              )}
            />
            {errors.vendorCategory && (
              <p className="text-xs text-destructive">{errors.vendorCategory.message as string}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Vendor Location *</Label>
            <Controller
              name="vendorLocation"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={field.value && field.value.length
                    ? Array.from(new Set(field.value)).map((v) => ({ label: v, value: v }))
                    : []}
                  selected={field.value || []}
                  onChange={field.onChange}
                  placeholder="Type location and press enter (or pick existing)"
                  allowCreate
                  className={errors.vendorLocation ? 'border-destructive' : ''}
                />
              )}
            />
            {errors.vendorLocation && (
              <p className="text-xs text-destructive">{errors.vendorLocation.message as string}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Vendor Identification Source *</Label>
            <Controller
              name="identificationSource"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={IDENTIFICATION_SOURCES.map((s) => ({ label: s, value: s }))}
                  selected={field.value || []}
                  onChange={field.onChange}
                  placeholder="Select identification sources"
                  className={errors.identificationSource ? 'border-destructive' : ''}
                />
              )}
            />
            {errors.identificationSource && (
              <p className="text-xs text-destructive">{errors.identificationSource.message as string}</p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
