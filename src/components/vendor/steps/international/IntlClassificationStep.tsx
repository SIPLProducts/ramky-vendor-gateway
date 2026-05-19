import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Award } from 'lucide-react';
import { InternationalClassification } from '@/types/vendor';
import { ClassificationField } from '@/components/vendor/ClassificationField';

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

const asArr = (v: unknown): string[] =>
  Array.isArray(v) ? (v as string[]) : (v ? [String(v)] : []);

export function IntlClassificationStep({ data, onSubmit, onLiveUpdate }: Props) {
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
          <Controller
            name="materialGroupVendor"
            control={control}
            render={({ field }) => (
              <ClassificationField
                label="Material Group for Vendors"
                required
                masterType="material_group_vendor"
                value={(field.value as string[]) || []}
                onChange={field.onChange}
                errorText={errors.materialGroupVendor?.message as string}
                selectPlaceholder="Select material groups"
              />
            )}
          />
          <Controller
            name="vendorLocation"
            control={control}
            render={({ field }) => (
              <ClassificationField
                label="Vendor Location"
                required
                masterType="vendor_location"
                value={(field.value as string[]) || []}
                onChange={field.onChange}
                errorText={errors.vendorLocation?.message as string}
                selectPlaceholder="Select locations"
              />
            )}
          />
          <Controller
            name="vendorCategory"
            control={control}
            render={({ field }) => (
              <ClassificationField
                label="Vendor Category"
                masterType="vendor_category"
                value={(field.value as string[]) || []}
                onChange={field.onChange}
                errorText={errors.vendorCategory?.message as string}
                selectPlaceholder="Select vendor categories"
              />
            )}
          />
          <Controller
            name="identificationSource"
            control={control}
            render={({ field }) => (
              <ClassificationField
                label="Vendor Identification Source"
                masterType="identification_source"
                value={(field.value as string[]) || []}
                onChange={field.onChange}
                errorText={errors.identificationSource?.message as string}
                selectPlaceholder="Select identification sources"
              />
            )}
          />
        </div>
      </div>
    </form>
  );
}
