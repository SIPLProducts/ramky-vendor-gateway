import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { InternationalCompanyDetails } from '@/types/vendor';
import { useSapMasterData } from '@/hooks/useSapMasterData';

const schema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required'),
  companyAddress: z.string().trim().min(5, 'Company address is required'),
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

  // Live push so autosave persists international fields
  useEffect(() => {
    const sub = watch((vals) => onLiveUpdate?.(vals as InternationalCompanyDetails));
    return () => sub.unsubscribe();
  }, [watch, onLiveUpdate]);

  // Reset region when country changes (unless still valid)
  const regionsForCountry = useMemo(() => {
    const list = regions || [];
    if (!selectedCountry) return list;
    const filtered = list.filter((r) => {
      const extra = (r.extra || {}) as Record<string, unknown>;
      const country = (extra.country || extra.country_code || extra.countryCode) as string | undefined;
      return !country || country === selectedCountry;
    });
    return filtered.length ? filtered : list;
  }, [regions, selectedCountry]);

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
                  countries && countries.length > 0 ? (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        setValue('region', '');
                      }}
                    >
                      <SelectTrigger className={errors.country ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => (
                          <SelectItem key={c.id} value={c.code}>
                            {c.code}{c.description ? ` — ${c.description}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="Country code (e.g. US, GB, DE)"
                      className={errors.country ? 'border-destructive' : ''}
                    />
                  )
                )}
              />
              {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
              {(!countries || countries.length === 0) && (
                <p className="text-xs text-muted-foreground">SAP country master not synced — enter the code manually.</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label>Region <span className="text-destructive ml-0.5">*</span></Label>
              <Controller
                name="region"
                control={control}
                render={({ field }) => (
                  regionsForCountry && regionsForCountry.length > 0 ? (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!selectedCountry}>
                      <SelectTrigger className={errors.region ? 'border-destructive' : ''}>
                        <SelectValue placeholder={selectedCountry ? 'Select region' : 'Select country first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {regionsForCountry.map((r) => (
                          <SelectItem key={r.id} value={r.code}>
                            {r.code}{r.description ? ` — ${r.description}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="Region / State"
                      className={errors.region ? 'border-destructive' : ''}
                      disabled={!selectedCountry}
                    />
                  )
                )}
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
