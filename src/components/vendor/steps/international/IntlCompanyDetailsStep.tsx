import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { InternationalCompanyDetails } from '@/types/vendor';
import { supabase } from '@/integrations/supabase/client';
import { useSapMasterData } from '@/hooks/useSapMasterData';

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
    const sub = watch((vals) => onLiveUpdate?.(vals as InternationalCompanyDetails));
    return () => sub.unsubscribe();
  }, [watch, onLiveUpdate]);

  // Cache fallback (same source that Company Code / Rec-Account rely on in SAP Sync)
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
  // Only surface the red error state when we have nothing to show at all.
  const countriesError = !hasCountries ? f4Error : null;
  const regionsError = !!selectedCountry && regionsForCountry.length === 0 && !regionsFetching ? f4Error : null;
  const retryCountries = fetchF4;
  const retryRegions = fetchF4;
  const countryDisabled = countriesFetching || !hasCountries;

  return (
    <form id="step-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
