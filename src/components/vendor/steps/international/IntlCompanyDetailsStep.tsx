import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { InternationalCompanyDetails } from '@/types/vendor';
import { useEnsureSapMaster } from '@/hooks/useSapMasterData';

const schema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required'),
  companyAddress: z.string().trim().optional().or(z.literal('')),
  pincode: z.string().trim().min(2, 'Pincode is required'),
  country: z.string().trim().min(1, 'Country is required'),
  region: z.string().trim().min(1, 'Region is required'),
  contact1: z.string().regex(/^\d{6,15}$/, 'Enter a valid phone number (digits only)'),
  contact2: z.string().regex(/^\d{6,15}$/, 'Digits only').or(z.literal('')),
  email1: z.string().trim().email('Enter a valid email'),
  email2: z.string().trim().email('Enter a valid email').or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  data: InternationalCompanyDetails;
  onSubmit: (data: InternationalCompanyDetails) => void;
  onLiveUpdate?: (data: InternationalCompanyDetails) => void;
}

export function IntlCompanyDetailsStep({ data, onSubmit, onLiveUpdate }: Props) {
  const { data: countries } = useSapMasterData('country');
  const { data: regions } = useSapMasterData('region');

  const {
    register, control, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: data,
  });

  const selectedCountry = watch('country');

  useEffect(() => {
    const sub = watch((vals) => onLiveUpdate?.(vals as InternationalCompanyDetails));
    return () => sub.unsubscribe();
  }, [watch, onLiveUpdate]);

  // Strict filter: only regions whose extra.LAND1 matches the selected country.
  const regionsForCountry = useMemo(() => {
    const list = regions || [];
    if (!selectedCountry) return [];
    return list.filter((r) => {
      const extra = (r.extra || {}) as Record<string, unknown>;
      return (extra.LAND1 as string | undefined) === selectedCountry;
    });
  }, [regions, selectedCountry]);

  const hasCountries = !!(countries && countries.length > 0);

  return (
    <form id="step-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">
          <Building2 className="h-5 w-5 text-primary" />
          Company Details
        </h3>

        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="companyName">Company Name <span className="text-destructive ml-0.5">*</span></Label>
              <Input id="companyName" {...register('companyName')} placeholder="Enter company name" className={errors.companyName ? 'border-destructive' : ''} />
              {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="pincode">Pincode / Postal Code <span className="text-destructive ml-0.5">*</span></Label>
              <Input id="pincode" {...register('pincode')} placeholder="Postal code" className={errors.pincode ? 'border-destructive' : ''} />
              {errors.pincode && <p className="text-xs text-destructive">{errors.pincode.message}</p>}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label>Country (From SAP) <span className="text-destructive ml-0.5">*</span></Label>
              <Controller
                name="country"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      setValue('region', '');
                    }}
                    disabled={!hasCountries}
                  >
                    <SelectTrigger className={errors.country ? 'border-destructive' : ''}>
                      <SelectValue placeholder={hasCountries ? 'Select country' : 'No SAP values — sync SAP master data'} />
                    </SelectTrigger>
                    <SelectContent>
                      {(countries || []).map((c) => (
                        <SelectItem key={c.id} value={c.code}>
                          {c.code}{c.description ? ` — ${c.description}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
              {!hasCountries && (
                <p className="text-xs text-muted-foreground">No SAP values — sync SAP master data.</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label>Region (From SAP) <span className="text-destructive ml-0.5">*</span></Label>
              <Controller
                name="region"
                control={control}
                render={({ field }) => {
                  const hasRegions = regionsForCountry.length > 0;
                  return (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!selectedCountry || !hasRegions}
                    >
                      <SelectTrigger className={errors.region ? 'border-destructive' : ''}>
                        <SelectValue
                          placeholder={
                            !selectedCountry
                              ? 'Select country first'
                              : hasRegions
                              ? 'Select region'
                              : 'No SAP regions for this country'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {regionsForCountry.map((r) => {
                          const extra = (r.extra || {}) as Record<string, unknown>;
                          const bland = (extra.BLAND as string | undefined) ?? r.code;
                          return (
                            <SelectItem key={r.id} value={bland}>
                              {bland}{r.description ? ` — ${r.description}` : ''}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  );
                }}
              />
              {errors.region && <p className="text-xs text-destructive">{errors.region.message}</p>}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="contact1">Company Contact 1 <span className="text-destructive ml-0.5">*</span></Label>
              <Input id="contact1" inputMode="numeric" {...register('contact1')} placeholder="Numbers only" className={errors.contact1 ? 'border-destructive' : ''} />
              {errors.contact1 && <p className="text-xs text-destructive">{errors.contact1.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email1">Company Email 1 <span className="text-destructive ml-0.5">*</span></Label>
              <Input id="email1" type="email" {...register('email1')} placeholder="primary@company.com" className={errors.email1 ? 'border-destructive' : ''} />
              {errors.email1 && <p className="text-xs text-destructive">{errors.email1.message}</p>}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="companyAddress">Company Address</Label>
            <Textarea id="companyAddress" rows={3} {...register('companyAddress')} placeholder="Full registered address (optional)" className={errors.companyAddress ? 'border-destructive' : ''} />
            {errors.companyAddress && <p className="text-xs text-destructive">{errors.companyAddress.message}</p>}
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="contact2">Company Contact 2</Label>
              <Input id="contact2" inputMode="numeric" {...register('contact2')} placeholder="Numbers only (optional)" className={errors.contact2 ? 'border-destructive' : ''} />
              {errors.contact2 && <p className="text-xs text-destructive">{errors.contact2.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email2">Company Email 2</Label>
              <Input id="email2" type="email" {...register('email2')} placeholder="secondary@company.com (optional)" className={errors.email2 ? 'border-destructive' : ''} />
              {errors.email2 && <p className="text-xs text-destructive">{errors.email2.message}</p>}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
