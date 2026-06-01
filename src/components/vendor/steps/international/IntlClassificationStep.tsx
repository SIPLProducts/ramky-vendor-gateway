import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Award } from 'lucide-react';
import { InternationalClassification } from '@/types/vendor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

const firstStr = (v: string[] | undefined): string => (v && v.length > 0 ? v[0] : '');

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

  const renderTextField = (
    name: keyof FormValues,
    label: string,
    placeholder: string,
    required: boolean,
    errorText?: string,
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const current = firstStr(field.value as string[]);
        return (
          <div className="grid gap-1.5">
            <Label>
              {label}
              {required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            <Input
              value={current}
              placeholder={placeholder}
              onChange={(e) => {
                const val = e.target.value;
                field.onChange(val.trim() === '' ? [] : [val]);
              }}
              className={errorText ? 'border-destructive' : ''}
            />
            {errorText && <p className="text-xs text-destructive">{errorText}</p>}
          </div>
        );
      }}
    />
  );

  return (
    <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">
          <Award className="h-5 w-5 text-primary" />
          Classification
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enter classification details manually.
        </p>

        <div className="grid md:grid-cols-2 gap-5">
          {renderTextField(
            'materialGroupVendor',
            'Material Group for Vendors',
            'Enter material group',
            true,
            errors.materialGroupVendor?.message as string,
          )}
          {renderTextField(
            'vendorLocation',
            'Vendor Location',
            'Enter vendor location',
            true,
            errors.vendorLocation?.message as string,
          )}
          {renderTextField(
            'vendorCategory',
            'Vendor Category',
            'Enter vendor category',
            false,
            errors.vendorCategory?.message as string,
          )}
          {renderTextField(
            'identificationSource',
            'Vendor Identification Source',
            'Enter identification source',
            false,
            errors.identificationSource?.message as string,
          )}
        </div>
      </div>
    </form>
  );
}
