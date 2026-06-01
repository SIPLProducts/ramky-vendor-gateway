import { useEffect, useRef } from 'react';
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
  onNext: (data: { organization: OrganizationDetails; statutory: StatutoryDetails }) => void;
  onLiveUpdate?: (data: { organization: OrganizationDetails; statutory: StatutoryDetails }) => void;
}

export function OrganizationStep({ data, statutoryData, vendorId, tenantId, onNext, onLiveUpdate }: OrganizationStepProps) {
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
  const { data: sapVendorLoc } = useSapMasterData('vendor_location');
  const { data: sapIdSource } = useSapMasterData('identification_source');

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...data,
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
    },
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

  return (
    <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">
          <Building2 className="h-5 w-5 text-primary" />
          Organization Profile
        </h3>

        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="buyerCompanyDisplay">Buyer Company *</Label>
            <Controller
              name="buyerCompanyId"
              control={control}
              render={({ field }) => {
                const company = buyerCompanies?.find((c) => c.id === field.value);
                const display = company
                  ? `${company.name} (${company.code})`
                  : '';
                const showLoading = isLoadingCompanies && field.value && !company;
                return (
                  <>
                    <input type="hidden" value={field.value || ''} readOnly />
                    <div
                      id="buyerCompanyDisplay"
                      className={
                        'flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm ' +
                        (errors.buyerCompanyId ? 'border-destructive' : 'border-input')
                      }
                    >
                      {showLoading ? (
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading company…
                        </span>
                      ) : display ? (
                        <span className="font-medium text-foreground">{display}</span>
                      ) : (
                        <span className="text-muted-foreground">Not assigned</span>
                      )}
                    </div>
                  </>
                );
              }}
            />
            <p className="text-xs text-muted-foreground">Assigned by buyer — cannot be changed.</p>
            {errors.buyerCompanyId && (
              <p className="text-xs text-destructive">{errors.buyerCompanyId.message}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="legalName">Legal Name of Organization *</Label>
            <Input
              id="legalName"
              {...register('legalName')}
              placeholder="Enter registered company name"
              className={errors.legalName ? 'border-destructive' : ''}
            />
            {errors.legalName && (
              <p className="text-xs text-destructive">{errors.legalName.message}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tradeName">Trade Name / Brand Name</Label>
            <Input
              id="tradeName"
              {...register('tradeName')}
              placeholder="Enter trade name if different from legal name"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label>Type of Industry *</Label>
              <Controller
                name="industryType"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className={errors.industryType ? 'border-destructive' : ''}>
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
                    <SelectTrigger className={errors.organizationType ? 'border-destructive' : ''}>
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
          </div>

          <div className="grid gap-1.5">
            <Label>Type of Ownership *</Label>
            <Controller
              name="ownershipType"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className={errors.ownershipType ? 'border-destructive' : ''}>
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
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className={errors.state ? 'border-destructive' : ''}>
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
          <Controller
            name="vendorLocation"
            control={control}
            render={({ field }) => (
              <ClassificationField
                label="Vendor Location"
                masterType="vendor_location"
                value={field.value || []}
                onChange={field.onChange}
                selectPlaceholder="Select locations"
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
                value={field.value || []}
                onChange={field.onChange}
                selectPlaceholder="Select identification sources"
              />
            )}
          />
        </div>
      </div>

      <div className="hidden">
        {/* spacer */}

      {/* Statutory & Registrations (moved from Commercial Details) */}
      <div className="form-section">
        <h3 className="form-section-title">
          <FileCheck className="h-5 w-5 text-primary" />
          Statutory & Registrations
        </h3>

        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="firmRegistrationNo">Firm Registration No.</Label>
              <Input
                id="firmRegistrationNo"
                {...register('firmRegistrationNo')}
                placeholder="Enter registration number"
              />
            </div>
          </div>

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
            <Label>Memberships</Label>
            <Controller
              name="memberships"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={MEMBERSHIP_OPTIONS.map((opt) => ({ label: opt, value: opt }))}
                  selected={field.value || []}
                  onChange={field.onChange}
                  placeholder="Select memberships"
                />
              )}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Enlistment With</Label>
            <Controller
              name="enlistments"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={ENLISTMENT_OPTIONS.map((opt) => ({ label: opt, value: opt }))}
                  selected={field.value || []}
                  onChange={field.onChange}
                  placeholder="Select enlistments"
                />
              )}
            />
          </div>
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
