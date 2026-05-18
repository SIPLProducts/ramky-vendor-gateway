import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Award } from 'lucide-react';
import { InternationalClassification } from '@/types/vendor';

const schema = z.object({
  materialGroupVendor: z.string().trim().min(1, 'Material Group for Vendors is required'),
  vendorCategory: z.string().trim().min(1, 'Vendor Category is required'),
  vendorLocation: z.string().trim().min(1, 'Vendor Location is required'),
  identificationSource: z.string().trim().min(1, 'Vendor Identification Source is required'),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  data: InternationalClassification;
  onSubmit: (data: InternationalClassification) => void;
  onLiveUpdate?: (data: InternationalClassification) => void;
}

const toStr = (arr?: string[]) => (arr && arr.length ? arr.join(', ') : '');
const toArr = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export function IntlClassificationStep({ data, onSubmit, onLiveUpdate }: Props) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      materialGroupVendor: toStr(data.materialGroupVendor),
      vendorCategory: toStr(data.vendorCategory),
      vendorLocation: toStr(data.vendorLocation),
      identificationSource: toStr(data.identificationSource),
    },
  });

  useEffect(() => {
    const sub = watch((vals) => {
      const v = vals as FormValues;
      onLiveUpdate?.({
        materialGroupVendor: toArr(v.materialGroupVendor || ''),
        vendorCategory: toArr(v.vendorCategory || ''),
        vendorLocation: toArr(v.vendorLocation || ''),
        identificationSource: toArr(v.identificationSource || ''),
      });
    });
    return () => sub.unsubscribe();
  }, [watch, onLiveUpdate]);

  const handleFormSubmit = (v: FormValues) => {
    onSubmit({
      materialGroupVendor: toArr(v.materialGroupVendor),
      vendorCategory: toArr(v.vendorCategory),
      vendorLocation: toArr(v.vendorLocation),
      identificationSource: toArr(v.identificationSource),
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
          Enter each value manually. Separate multiple values with commas.
        </p>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="materialGroupVendor">Material Group for Vendors *</Label>
            <Input id="materialGroupVendor" {...register('materialGroupVendor')} placeholder="e.g. Steel, Cement" className={errors.materialGroupVendor ? 'border-destructive' : ''} />
            {errors.materialGroupVendor && <p className="text-xs text-destructive">{errors.materialGroupVendor.message}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="vendorCategory">Vendor Category *</Label>
            <Input id="vendorCategory" {...register('vendorCategory')} placeholder="e.g. Manufacturer, Trader" className={errors.vendorCategory ? 'border-destructive' : ''} />
            {errors.vendorCategory && <p className="text-xs text-destructive">{errors.vendorCategory.message}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="vendorLocation">Vendor Location *</Label>
            <Input id="vendorLocation" {...register('vendorLocation')} placeholder="e.g. Dubai, Singapore" className={errors.vendorLocation ? 'border-destructive' : ''} />
            {errors.vendorLocation && <p className="text-xs text-destructive">{errors.vendorLocation.message}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="identificationSource">Vendor Identification Source *</Label>
            <Input id="identificationSource" {...register('identificationSource')} placeholder="e.g. Trade Fair, Reference" className={errors.identificationSource ? 'border-destructive' : ''} />
            {errors.identificationSource && <p className="text-xs text-destructive">{errors.identificationSource.message}</p>}
          </div>
        </div>
      </div>
    </form>
  );
}
