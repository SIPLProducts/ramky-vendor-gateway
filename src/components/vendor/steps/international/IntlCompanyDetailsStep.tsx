import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Loader2, AlertTriangle, RefreshCw, MapPin } from 'lucide-react';
import { InternationalCompanyDetails } from '@/types/vendor';
import { supabase } from '@/integrations/supabase/client';
import { useSapMasterData } from '@/hooks/useSapMasterData';
import { splitAddressIntoLines } from '@/lib/addressAutoflow';

const schema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required'),
  addressLine1: z.string().trim().min(1, 'Address Line 1 is required').max(40, 'Maximum 40 characters allowed'),
  addressLine2: z.string().max(40, 'Maximum 40 characters allowed').optional().or(z.literal('')),
  addressLine3: z.string().max(40, 'Maximum 40 characters allowed').optional().or(z.literal('')),
  addressLine4: z.string().max(40, 'Maximum 40 characters allowed').optional().or(z.literal('')),
  city: z.string().trim().min(1, 'City is required'),
  pincode: z.string().trim().min(2, 'PIN Code is required'),
  officePhone: z.string().regex(/^\d{10}$/, '10-digit mobile number required').or(z.literal('')),
  fax: z.string().optional().or(z.literal('')),
  companyAddress: z.string().optional().or(z.literal('')),
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
  tenantId?: string | null;
}

type F4Item = Record<string, unknown>;

export function IntlCompanyDetailsStep({ data, onSubmit, onLiveUpdate, tenantId }: Props) {
  const [liveF4, setLiveF4] = useState<Record<string, F4Item[]> | null>(null);
  const [f4Fetching, setF4Fetching] = useState(false);
  const [f4Error, setF4Error] = useState<string | null>(null);

  const fetchF4 = useCallback(async () => {
    setF4Fetching(true);
    setF4Error(null);
    try {
      const { data: res, error } = await supabase.functions.invoke('sap-master-fetch', {
        body: { master_type: ['country', 'region'] },
      });
      if (error) throw error;
      if (res?.sap_response && typeof res.sap_response === 'object') {
        setLiveF4(res.sap_response as Record<string, F4Item[]>);
      }
      if (res && res.success === false) {
        const msg = [res.message, res.hint].filter(Boolean).join(' — ');
        setF4Error(msg || 'SAP F4 fetch failed');
      }
    } catch (e: any) {
      setF4Error(e?.message || 'Could not reach SAP');
    } finally {
      setF4Fetching(false);
    }
  }, []);

  useEffect(() => { fetchF4(); }, [fetchF4]);

  const { data: buyerCompany, isLoading: buyerCompanyLoading } = useQuery({
    queryKey: ['tenant-buyer-company', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, code')
        .eq('id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const {
    register, control, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: data,
    values: data as FormValues,
    resetOptions: { keepDirtyValues: true, keepDirty: true },
  });

  const selectedCountry = watch('country');

  useEffect(() => {
    const sub = watch((vals) => {
      const v = vals as FormValues;
      const joined = [v.addressLine1, v.addressLine2, v.addressLine3, v.addressLine4]
        .filter(Boolean).join(', ');
      onLiveUpdate?.({ ...(v as InternationalCompanyDetails), companyAddress: joined });
    });
    return () => sub.unsubscribe();
  }, [watch, onLiveUpdate]);

  // Cascade a pre-populated long Address Line 1 into Lines 2-4 on mount.
  useEffect(() => {
    const raw = (data as any)?.addressLine1 as string | undefined;
    if (!raw || raw.length <= 40) return;
    if ((data as any)?.addressLine2 || (data as any)?.addressLine3 || (data as any)?.addressLine4) return;
    const [l1, l2, l3, l4] = splitAddressIntoLines(raw);
    setValue('addressLine1', l1, { shouldValidate: true, shouldDirty: true });
    setValue('addressLine2', l2, { shouldValidate: true, shouldDirty: true });
    setValue('addressLine3', l3, { shouldValidate: true, shouldDirty: true });
    setValue('addressLine4', l4, { shouldValidate: true, shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const handleAddressLine1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const [l1, l2, l3, l4] = splitAddressIntoLines(raw);
    setValue('addressLine1', l1, { shouldValidate: true, shouldDirty: true });
    if (raw.length > 40 || l2) {
      setValue('addressLine2', l2, { shouldValidate: true, shouldDirty: true });
      setValue('addressLine3', l3, { shouldValidate: true, shouldDirty: true });
      setValue('addressLine4', l4, { shouldValidate: true, shouldDirty: true });
    }
  };

  const addressLine1 = watch('addressLine1');

  const { data: cachedCountries, isLoading: cachedCountriesLoading } = useSapMasterData('country');
  const { data: cachedRegions, isLoading: cachedRegionsLoading } = useSapMasterData('region');

  const liveCountries = (liveF4?.COUNTRY || []) as F4Item[];
  const liveRegions = (liveF4?.REGION || []) as F4Item[];
  const useLiveCountry = liveCountries.length > 0;
  const useLiveRegion = liveRegions.length > 0;

  const countries = useMemo(() => {
    if (useLiveCountry) {
      return liveCountries
        .map((it, idx) => {
          const code = String((it.LAND1 ?? (it as any).code ?? '') as string);
          const desc = String((it.LANDX ?? it.NATIO ?? (it as any).description ?? '') as string);
          return { id: `c-live-${idx}-${code}`, code, desc };
        })
        .filter((c) => c.code);
    }
    return (cachedCountries || [])
      .map((r, idx) => {
        const extra = (r.extra || {}) as Record<string, unknown>;
        const code = String((extra.LAND1 ?? r.code ?? '') as string);
        const desc = String((extra.LANDX ?? extra.NATIO ?? r.description ?? '') as string);
        return { id: `c-cache-${idx}-${r.id}`, code, desc };
      })
      .filter((c) => c.code);
  }, [useLiveCountry, liveCountries, cachedCountries]);

  const regionsForCountry = useMemo(() => {
    if (!selectedCountry) return [] as { id: string; code: string; desc: string }[];
    if (useLiveRegion) {
      return liveRegions
        .filter((it) => String((it.LAND1 ?? '') as string) === selectedCountry)
        .map((it, idx) => {
          const code = String((it.BLAND ?? (it as any).code ?? '') as string);
          const desc = String((it.BEZEI ?? (it as any).description ?? '') as string);
          return { id: `r-live-${idx}-${code}`, code, desc };
        })
        .filter((r) => r.code);
    }
    return (cachedRegions || [])
      .filter((r) => {
        const extra = (r.extra || {}) as Record<string, unknown>;
        return String((extra.LAND1 ?? '') as string) === selectedCountry;
      })
      .map((r, idx) => {
        const extra = (r.extra || {}) as Record<string, unknown>;
        const code = String((extra.BLAND ?? r.code ?? '') as string);
        const desc = String((extra.BEZEI ?? r.description ?? '') as string);
        return { id: `r-cache-${idx}-${r.id}`, code, desc };
      })
      .filter((r) => r.code);
  }, [useLiveRegion, liveRegions, cachedRegions, selectedCountry]);

  const hasCountries = countries.length > 0;
  const usingCachedCountries = !useLiveCountry && hasCountries;
  const usingCachedRegions = !useLiveRegion && regionsForCountry.length > 0;

  const countriesFetching = (f4Fetching || cachedCountriesLoading) && !hasCountries;
  const regionsFetching = (f4Fetching || cachedRegionsLoading) && regionsForCountry.length === 0 && !!selectedCountry;
  const countriesError = !hasCountries ? f4Error : null;
  const regionsError = !!selectedCountry && regionsForCountry.length === 0 && !regionsFetching ? f4Error : null;
  const retryCountries = fetchF4;
  const retryRegions = fetchF4;
  const countryDisabled = countriesFetching || !hasCountries;

  const submit = (v: FormValues) => {
    const joined = [v.addressLine1, v.addressLine2, v.addressLine3, v.addressLine4]
      .filter(Boolean).join(', ');
    onSubmit({ ...(v as InternationalCompanyDetails), companyAddress: joined });
  };

  return (
    <form id="step-form" onSubmit={handleSubmit(submit)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">
          <Building2 className="h-5 w-5 text-primary" />
          Company Details
        </h3>

        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="buyerCompanyDisplay">Buyer Company <span className="text-destructive ml-0.5">*</span></Label>
            <div
              id="buyerCompanyDisplay"
              className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm"
            >
              {buyerCompanyLoading ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading company…
                </span>
              ) : buyerCompany ? (
                <span className="font-medium text-foreground">
                  {buyerCompany.name}{buyerCompany.code ? ` (${buyerCompany.code})` : ''}
                </span>
              ) : (
                <span className="text-muted-foreground">Not assigned</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Assigned by buyer — cannot be changed.</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="companyName">Company Name <span className="text-destructive ml-0.5">*</span></Label>
            <Input id="companyName" {...register('companyName')} placeholder="Enter company name" className={errors.companyName ? 'border-destructive' : ''} />
            {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
          </div>
        </div>
      </div>

      {/* Address block — mirrors the domestic Registered Address layout */}
      <div className="form-section">
        <h3 className="form-section-title">
          <MapPin className="h-5 w-5 text-primary" />
          Address
        </h3>

        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="addressLine1">Address Line 1 <span className="text-destructive ml-0.5">*</span></Label>
            <Input
              id="addressLine1"
              value={addressLine1 || ''}
              onChange={handleAddressLine1Change}
              placeholder="Building name, street address (overflow auto-flows into Lines 2-4)"
              maxLength={160}
              className={errors.addressLine1 ? 'border-destructive' : ''}
            />
            <p className="text-xs text-muted-foreground">
              Text beyond 40 characters automatically flows into Address Line 2, 3 and 4.
            </p>
            {errors.addressLine1 && <p className="text-xs text-destructive">{errors.addressLine1.message}</p>}
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input id="addressLine2" {...register('addressLine2')} placeholder="Area, locality" maxLength={40} className={errors.addressLine2 ? 'border-destructive' : ''} />
              {errors.addressLine2 && <p className="text-xs text-destructive">{errors.addressLine2.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="addressLine3">Address Line 3</Label>
              <Input id="addressLine3" {...register('addressLine3')} placeholder="Landmark" maxLength={40} className={errors.addressLine3 ? 'border-destructive' : ''} />
              {errors.addressLine3 && <p className="text-xs text-destructive">{errors.addressLine3.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="addressLine4">Address Line 4</Label>
              <Input id="addressLine4" {...register('addressLine4')} placeholder="Additional detail (optional)" maxLength={40} className={errors.addressLine4 ? 'border-destructive' : ''} />
              {errors.addressLine4 && <p className="text-xs text-destructive">{errors.addressLine4.message}</p>}
            </div>
          </div>


          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="officePhone">Office Phone</Label>
              <Input id="officePhone" inputMode="numeric" {...register('officePhone')} placeholder="10-digit mobile number" maxLength={10} className={errors.officePhone ? 'border-destructive' : ''} />
              {errors.officePhone && <p className="text-xs text-destructive">{errors.officePhone.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fax">Fax</Label>
              <Input id="fax" {...register('fax')} placeholder="Fax number" className={errors.fax ? 'border-destructive' : ''} />
              {errors.fax && <p className="text-xs text-destructive">{errors.fax.message}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* SAP Country / Region + primary contacts */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Building2 className="h-5 w-5 text-primary" />
          Country, Region & Contacts
        </h3>

        <div className="grid gap-5">
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
                    disabled={countryDisabled}
                  >
                    <SelectTrigger className={errors.country ? 'border-destructive' : ''}>
                      <SelectValue placeholder={
                        countriesFetching
                          ? 'Fetching country from SAP…'
                          : countriesError
                          ? 'Country fetch failed'
                          : hasCountries
                          ? 'Select country'
                          : 'No SAP values — click Sync now'
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.id} value={c.code}>
                          {c.code}{c.desc ? ` — ${c.desc}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
              {countriesFetching && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Fetching country from SAP…
                </p>
              )}
              {!countriesFetching && countriesError && (
                <div className="text-xs text-destructive flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p>Country fetch failed — {countriesError}</p>
                    <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={retryCountries}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Retry
                    </Button>
                  </div>
                </div>
              )}
              {!countriesFetching && !countriesError && !hasCountries && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>No SAP values returned.</span>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={retryCountries}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Sync now
                  </Button>
                </div>
              )}
              {!countriesFetching && !countriesError && usingCachedCountries && (
                <p className="text-[11px] text-muted-foreground">Using cached SAP values.</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label>Region (From SAP) <span className="text-destructive ml-0.5">*</span></Label>
              <Controller
                name="region"
                control={control}
                render={({ field }) => {
                  const hasRegions = regionsForCountry.length > 0;
                  const regionDisabled = !selectedCountry || regionsFetching || !!regionsError || !hasRegions;
                  return (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={regionDisabled}
                    >
                      <SelectTrigger className={errors.region ? 'border-destructive' : ''}>
                        <SelectValue
                          placeholder={
                            !selectedCountry
                              ? 'Select country first'
                              : regionsFetching
                              ? 'Fetching region from SAP…'
                              : regionsError
                              ? 'Region fetch failed'
                              : hasRegions
                              ? 'Select region'
                              : 'No SAP regions for this country'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {regionsForCountry.map((r) => (
                          <SelectItem key={r.id} value={r.code}>
                            {r.code}{r.desc ? ` — ${r.desc}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }}
              />
              {errors.region && <p className="text-xs text-destructive">{errors.region.message}</p>}
              {regionsFetching && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Fetching region from SAP…
                </p>
              )}
              {!regionsFetching && regionsError && (
                <div className="text-xs text-destructive flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p>Region fetch failed — {regionsError}</p>
                    <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={retryRegions}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Retry
                    </Button>
                  </div>
                </div>
              )}
              {!regionsFetching && !regionsError && usingCachedRegions && (
                <p className="text-[11px] text-muted-foreground">Using cached SAP values.</p>
              )}
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
