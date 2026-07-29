import { useEffect, useMemo, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { FileUpload } from '@/components/vendor/FileUpload';
import { Building2, Loader2, FileCheck, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSapMasterData, SapMasterRow } from '@/hooks/useSapMasterData';
import { ClassificationField } from '@/components/vendor/ClassificationField';
import { toast } from 'sonner';

import {
  OrganizationDetails,
  StatutoryDetails,
  INDUSTRY_TYPES,
  ORGANIZATION_TYPES,
  OWNERSHIP_TYPES,
  MEMBERSHIP_OPTIONS,
  ENLISTMENT_OPTIONS,
  CERTIFICATION_OPTIONS,
  INDIAN_STATES,
  GST_STATE_CODE_MAP,
} from '@/types/vendor';

const sapOptions = (rows: SapMasterRow[] | undefined) =>
  (rows || []).map((r) => ({ value: r.code, label: r.description ? `${r.code} — ${r.description}` : r.code }));

const schema = z.object({
  buyerCompanyId: z.string().min(1, 'Buyer company is required'),
  legalName: z.string().min(2, 'Legal name is required'),
  tradeName: z.string().optional(),
  industryType: z.string().min(1, 'Industry type is required'),
  organizationType: z.string().min(1, 'Organization type is required'),
  ownershipType: z.string().min(1, 'Ownership type is required'),
  state: z.string().min(1, 'State is required'),
  accountingGroup: z.enum(['Import', 'Domestic']).optional(),
  // SAP Classification — now captured on SAP Sync screen (not in registration)
  materialGroupVendor: z.array(z.string()).optional().default([]),
  vendorCategory: z.array(z.string()).optional().default([]),
  vendorLocation: z.array(z.string()).optional().default([]),
  identificationSource: z.array(z.string()).optional().default([]),
  // Statutory & Memberships (moved here from former Commercial step)
  entityType: z.string().optional(),
  firmRegistrationNo: z.string().optional(),
  pfNumber: z.string().optional(),
  esiNumber: z.string().optional(),
  iecNo: z.string().optional(),
  swiftIbanCode: z.string().optional(),
  labourPermitNo: z.string().optional(),
  memberships: z.array(z.string()).optional(),
  enlistments: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  operationalNetwork: z.string().optional(),
});

type FormValues = OrganizationDetails & {
  entityType: string;
  firmRegistrationNo: string;
  pfNumber: string;
  esiNumber: string;
  iecNo: string;
  swiftIbanCode: string;
  labourPermitNo: string;
  memberships: string[];
  enlistments: string[];
  certifications: string[];
  operationalNetwork: string;
};

interface OrganizationStepProps {
  data: OrganizationDetails;
  statutoryData: StatutoryDetails;
  vendorId?: string;
  tenantId?: string | null;
  showClassification?: boolean;
  onNext: (data: { organization: OrganizationDetails; statutory: StatutoryDetails }) => void;
  onLiveUpdate?: (data: { organization: OrganizationDetails; statutory: StatutoryDetails }) => void;
}

export function OrganizationStep({ data, statutoryData, vendorId, tenantId, showClassification = true, onNext, onLiveUpdate }: OrganizationStepProps) {
  const { data: buyerCompanies, isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['buyer-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: sapMatGrp } = useSapMasterData('material_group_vendor');
  const { data: sapVendorCat } = useSapMasterData('vendor_category');

  const formValues = useMemo<FormValues>(() => ({
    ...(data as FormValues),
    state: data?.state || '',
    accountingGroup: (data?.accountingGroup as 'Import' | 'Domestic') || undefined,
    materialGroupVendor: Array.isArray(data?.materialGroupVendor) ? data!.materialGroupVendor as string[] : (data?.materialGroupVendor ? [data.materialGroupVendor as unknown as string] : []),
    vendorCategory: Array.isArray(data?.vendorCategory) ? data!.vendorCategory as string[] : (data?.vendorCategory ? [data.vendorCategory as unknown as string] : []),
    vendorLocation: Array.isArray(data?.vendorLocation) ? data!.vendorLocation as string[] : (data?.vendorLocation ? [data.vendorLocation as unknown as string] : []),
    identificationSource: Array.isArray(data?.identificationSource) ? data!.identificationSource as string[] : (data?.identificationSource ? [data.identificationSource as unknown as string] : []),
    entityType: statutoryData?.entityType || '',
    firmRegistrationNo: statutoryData?.firmRegistrationNo || '',
    pfNumber: statutoryData?.pfNumber || '',
    esiNumber: statutoryData?.esiNumber || '',
    iecNo: statutoryData?.iecNo || '',
    swiftIbanCode: statutoryData?.swiftIbanCode || '',
    labourPermitNo: statutoryData?.labourPermitNo || '',
    memberships: statutoryData?.memberships || [],
    enlistments: statutoryData?.enlistments || [],
    certifications: statutoryData?.certifications || [],
    operationalNetwork: statutoryData?.operationalNetwork || '',
  }), [data, statutoryData]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: formValues,
    values: formValues,
    resetOptions: { keepDirtyValues: true, keepDirty: true },
  });




  // Buyer Company is assigned by the invitation and must NOT reset to empty when
  // the vendor reopens the link. Hydrate from tenantId/data.buyerCompanyId once
  // either becomes available.
  const currentBuyer = watch('buyerCompanyId');
  useEffect(() => {
    const next = tenantId || data?.buyerCompanyId || '';
    if (next && next !== currentBuyer) {
      setValue('buyerCompanyId', next, { shouldDirty: false, shouldValidate: false });
    }
  }, [tenantId, data?.buyerCompanyId, currentBuyer, setValue]);

  // Legal Name / Trade Name are always sourced from the latest GST verification
  // (or PAN Holder Name when GST is not registered). They are read-only in the
  // UI, so we force-sync them from props whenever the parent updates — this is
  // required because `keepDirtyValues` would otherwise preserve a stale value
  // from a previously uploaded GST document.
  const watchedLegal = watch('legalName');
  const watchedTrade = watch('tradeName');
  useEffect(() => {
    const nextLegal = data?.legalName || '';
    if (nextLegal !== watchedLegal) {
      setValue('legalName', nextLegal, { shouldDirty: false, shouldValidate: false });
    }
  }, [data?.legalName]);
  useEffect(() => {
    const nextTrade = data?.tradeName || '';
    if (nextTrade !== watchedTrade) {
      setValue('tradeName', nextTrade, { shouldDirty: false, shouldValidate: false });
    }
  }, [data?.tradeName]);

  // Field-lock flags: once GST or PAN has been verified, the Organization
  // step must not allow editing these identity fields.
  const gstVerified = statutoryData?.isGstRegistered === true && !!statutoryData?.gstin;
  const panVerified = !!statutoryData?.pan && !!statutoryData?.panHolderName;
  const identityLocked = gstVerified || panVerified;
  const identitySourceLabel = gstVerified
    ? 'Auto-filled from GST Verification'
    : panVerified
      ? 'Auto-filled from PAN Verification'
      : '';


  // Auto-populate Vendor Location (Classification) directly from the selected State.
  // Vendor Location mirrors the State value and is read-only.
  const watchedState = watch('state');
  const watchedVendorLocation = watch('vendorLocation');
  useEffect(() => {
    const current = (watchedVendorLocation || [])[0] || '';
    if (!watchedState) {
      if (current) setValue('vendorLocation', [], { shouldDirty: true });
      return;
    }
    if (watchedState !== current) {
      setValue('vendorLocation', [watchedState], { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedState]);

  // Auto-populate State deterministically from the GSTIN's state code (first 2
  // digits). Falls back to an exact match on the jurisdiction-state text when
  // no GSTIN is available. We never infer from the principal-place address —
  // free-form addresses caused incorrect "Telangana" matches for AP vendors.
  const gstinForState = (statutoryData?.gstin || '').toUpperCase().replace(/\s+/g, '');
  const jurisdictionStateRaw = statutoryData?.gstJurisdictionState || '';
  const resolvedGstState = (() => {
    if (gstinForState.length >= 2) {
      const mapped = GST_STATE_CODE_MAP[gstinForState.slice(0, 2)];
      if (mapped) return mapped;
    }
    if (jurisdictionStateRaw) {
      const cleaned = jurisdictionStateRaw
        .replace(/^state\s*[-:]?\s*/i, '')
        .replace(/\s*state\s*tax\s*$/i, '')
        .trim()
        .toLowerCase();
      const match = INDIAN_STATES.find((s) => s.toLowerCase() === cleaned);
      if (match) return match;
    }
    return '';
  })();

  const isGstStateLocked = statutoryData?.isGstRegistered === true && !!resolvedGstState;

  // Track the last value we auto-set so we can refresh it when GST changes.
  // For GST-registered vendors, the GST-derived state is authoritative and
  // must overwrite any stale/manual value; non-GST vendors remain editable.
  const lastAutoStateRef = useRef<string>('');
  useEffect(() => {
    if (!resolvedGstState) return;
    const current = watchedState || '';
    if (!isGstStateLocked && current && current !== lastAutoStateRef.current) return;
    if (current === resolvedGstState) return;
    setValue('state', resolvedGstState, { shouldValidate: true, shouldDirty: true });
    lastAutoStateRef.current = resolvedGstState;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedGstState, isGstStateLocked]);




  // Live-push current form values up to parent so autosave persists Step-1 fields
  // (including the four classification multi-selects) without waiting for "Next".
  const liveUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLiveUpdateRef = useRef(onLiveUpdate);
  useEffect(() => { onLiveUpdateRef.current = onLiveUpdate; }, [onLiveUpdate]);
  useEffect(() => {
    const sub = watch((values) => {
      if (!onLiveUpdateRef.current) return;
      if (liveUpdateTimerRef.current) clearTimeout(liveUpdateTimerRef.current);
      liveUpdateTimerRef.current = setTimeout(() => {
        const v = values as FormValues;
        const organization: OrganizationDetails = {
          buyerCompanyId: v.buyerCompanyId || '',
          legalName: v.legalName || '',
          tradeName: v.tradeName || '',
          industryType: v.industryType || '',
          organizationType: v.organizationType || '',
          ownershipType: v.ownershipType || '',
          productCategories: data?.productCategories || [],
          productCategoriesOther: data?.productCategoriesOther || '',
          state: v.state || '',
          accountingGroup: v.accountingGroup || 'Domestic',
          materialGroupVendor: v.materialGroupVendor || [],
          vendorCategory: v.vendorCategory || [],
          vendorLocation: v.vendorLocation || [],
          identificationSource: v.identificationSource || [],
        };
        const statutory: StatutoryDetails = {
          ...statutoryData,
          entityType: v.entityType || '',
          firmRegistrationNo: v.firmRegistrationNo || '',
          pfNumber: v.pfNumber || '',
          esiNumber: v.esiNumber || '',
          iecNo: v.iecNo || '',
          swiftIbanCode: v.swiftIbanCode || '',
          labourPermitNo: v.labourPermitNo || '',
          memberships: v.memberships || [],
          enlistments: v.enlistments || [],
          certifications: v.certifications || [],
          operationalNetwork: v.operationalNetwork || '',
        };
        onLiveUpdateRef.current?.({ organization, statutory });
      }, 400);
    });
    return () => {
      sub.unsubscribe();
      if (liveUpdateTimerRef.current) clearTimeout(liveUpdateTimerRef.current);
    };
  }, [watch, statutoryData]);

  const handleFormSubmit = (values: FormValues) => {
    const organization: OrganizationDetails = {
      buyerCompanyId: values.buyerCompanyId,
      legalName: values.legalName,
      tradeName: values.tradeName || '',
      industryType: values.industryType,
      organizationType: values.organizationType,
      ownershipType: values.ownershipType,
      productCategories: data?.productCategories || [],
      productCategoriesOther: data?.productCategoriesOther || '',
      state: values.state,
      accountingGroup: values.accountingGroup || 'Domestic',
      materialGroupVendor: values.materialGroupVendor,
      vendorCategory: values.vendorCategory,
      vendorLocation: values.vendorLocation,
      identificationSource: values.identificationSource,
    };
    const statutory: StatutoryDetails = {
      ...statutoryData,
      entityType: values.entityType,
      firmRegistrationNo: values.firmRegistrationNo || '',
      pfNumber: values.pfNumber || '',
      esiNumber: values.esiNumber || '',
      iecNo: values.iecNo || '',
      swiftIbanCode: values.swiftIbanCode || '',
      labourPermitNo: values.labourPermitNo || '',
      memberships: values.memberships || [],
      enlistments: values.enlistments || [],
      certifications: values.certifications || [],
      operationalNetwork: values.operationalNetwork || '',
    };
    onNext({ organization, statutory });
  };

  const onInvalid = (errs: any) => {
    const firstKey = Object.keys(errs || {})[0];
    const firstMsg = firstKey ? (errs[firstKey]?.message as string) : 'Please complete the required fields.';
    toast.error(firstMsg || 'Please complete the required fields.');
    // Scroll to first invalid field
    if (firstKey) {
      const el = document.getElementById(firstKey) || document.querySelector(`[name="${firstKey}"]`);
      (el as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <form id="step-form-2" onSubmit={handleSubmit(handleFormSubmit, onInvalid)} className="vendor-styled-form space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">
          <Building2 className="h-5 w-5 text-primary" />
          Organization Profile
        </h3>

        <div className="grid md:grid-cols-2 gap-5">
          <Controller
            name="buyerCompanyId"
            control={control}
            render={({ field }) => (
              <input type="hidden" value={field.value || ''} readOnly />
            )}
          />

          <div className="grid gap-1.5">
            <Label htmlFor="legalName">Legal Name of Organization *</Label>
            <Input
              id="legalName"
              {...register('legalName')}
              placeholder={identityLocked ? '' : 'Enter registered company name'}
              data-required
              readOnly={identityLocked}
              className={`${errors.legalName ? 'border-destructive' : ''} ${identityLocked ? 'bg-muted/40 cursor-not-allowed' : ''}`}
            />
            {identityLocked && (
              <p className="text-[11px] text-muted-foreground">{identitySourceLabel}</p>
            )}
            {errors.legalName && (
              <p className="text-xs text-destructive">{errors.legalName.message}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tradeName">Trade Name / Brand Name</Label>
            <Input
              id="tradeName"
              {...register('tradeName')}
              placeholder={identityLocked ? '' : 'Enter trade name if different from legal name'}
              readOnly={identityLocked}
              className={identityLocked ? 'bg-muted/40 cursor-not-allowed' : ''}
            />
            {identityLocked && (
              <p className="text-[11px] text-muted-foreground">{identitySourceLabel}</p>
            )}
          </div>


          <div className="grid gap-1.5">
            <Label>Type of Industry *</Label>
            <Controller
              name="industryType"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger data-required className={errors.industryType ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select industry type" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.industryType && (
              <p className="text-xs text-destructive">{errors.industryType.message}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Type of Organization *</Label>
            <Controller
              name="organizationType"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger data-required className={errors.organizationType ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select organization type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORGANIZATION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.organizationType && (
              <p className="text-xs text-destructive">{errors.organizationType.message}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Type of Ownership *</Label>
            <Controller
              name="ownershipType"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger data-required className={errors.ownershipType ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select ownership type" />
                  </SelectTrigger>
                  <SelectContent>
                    {OWNERSHIP_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.ownershipType && (
              <p className="text-xs text-destructive">{errors.ownershipType.message}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>State *</Label>
            <Controller
              name="state"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value} disabled={isGstStateLocked}>
                  <SelectTrigger data-required className={errors.state ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.state && (
              <p className="text-xs text-destructive">{errors.state.message as string}</p>
            )}
          </div>

          {/* Accounting Group is derived from vendor type (Domestic / International) selected in step 1. */}
        </div>
      </div>


      {/* SAP Classification (Domestic) — values are passed to SAP Sync popup and editable there */}
      {showClassification && (
      <div className="form-section">
        <h3 className="form-section-title">
          <Award className="h-5 w-5 text-primary" />
          Classification
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select classification values from SAP F4 search help. These values are sent to the SAP Sync screen where the SAP team can review or modify them before syncing.
        </p>

        <div className="grid md:grid-cols-2 gap-5">
          <Controller
            name="materialGroupVendor"
            control={control}
            render={({ field }) => (
              <ClassificationField
                label="Material Group for Vendors"
                masterType="material_group_vendor"
                value={field.value || []}
                onChange={field.onChange}
                selectPlaceholder="Select material groups"
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
                value={field.value || []}
                onChange={field.onChange}
                selectPlaceholder="Select vendor categories"
              />
            )}
          />
        </div>
      </div>
      )}


      {/* Statutory & Registrations (moved from Commercial Details) */}
      <div className="form-section">
        <h3 className="form-section-title">
          <FileCheck className="h-5 w-5 text-primary" />
          Statutory & Registrations
        </h3>

        <div className="grid gap-5">

          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="pfNumber">PF Number</Label>
              <Input id="pfNumber" {...register('pfNumber')} placeholder="PF registration number" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="esiNumber">ESI Number</Label>
              <Input id="esiNumber" {...register('esiNumber')} placeholder="ESI registration number" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="labourPermitNo">Labour Permit No.</Label>
              <Input id="labourPermitNo" {...register('labourPermitNo')} placeholder="Labour permit number" />
            </div>
          </div>
        </div>
      </div>

      {/* Memberships & Certifications */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Award className="h-5 w-5 text-primary" />
          Memberships & Certifications
        </h3>

        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <Label>Certifications</Label>
            <Controller
              name="certifications"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={CERTIFICATION_OPTIONS.map((opt) => ({ label: opt, value: opt }))}
                  selected={field.value || []}
                  onChange={field.onChange}
                  placeholder="Select certifications"
                />
              )}
            />
          </div>
        </div>
      </div>
    </form>
  );
}
