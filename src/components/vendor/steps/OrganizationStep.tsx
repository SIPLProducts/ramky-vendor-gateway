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
import { Building2, Loader2, FileCheck, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  OrganizationDetails,
  StatutoryDetails,
  INDUSTRY_TYPES,
  ORGANIZATION_TYPES,
  OWNERSHIP_TYPES,
  PRODUCT_CATEGORIES,
  ENTITY_TYPES,
  MEMBERSHIP_OPTIONS,
  ENLISTMENT_OPTIONS,
  CERTIFICATION_OPTIONS,
  OPERATIONAL_NETWORKS,
} from '@/types/vendor';

const schema = z.object({
  buyerCompanyId: z.string().min(1, 'Buyer company is required'),
  legalName: z.string().min(2, 'Legal name is required'),
  tradeName: z.string().optional(),
  industryType: z.string().min(1, 'Industry type is required'),
  organizationType: z.string().min(1, 'Organization type is required'),
  ownershipType: z.string().min(1, 'Ownership type is required'),
  productCategories: z.array(z.string()).min(1, 'Select at least one product category'),
  productCategoriesOther: z.string().optional(),
  // Statutory & Memberships (moved here from former Commercial step)
  entityType: z.string().min(1, 'Entity type is required'),
  firmRegistrationNo: z.string().optional(),
  pfNumber: z.string().optional(),
  esiNumber: z.string().optional(),
  iecNo: z.string().optional(),
  labourPermitNo: z.string().optional(),
  memberships: z.array(z.string()).optional(),
  enlistments: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  operationalNetwork: z.string().optional(),
}).superRefine((vals, ctx) => {
  if (vals.productCategories?.includes('Others') && !vals.productCategoriesOther?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['productCategoriesOther'],
      message: 'Please specify the other category/service',
    });
  }
});

type FormValues = OrganizationDetails & {
  productCategoriesOther: string;
  entityType: string;
  firmRegistrationNo: string;
  pfNumber: string;
  esiNumber: string;
  iecNo: string;
  labourPermitNo: string;
  memberships: string[];
  enlistments: string[];
  certifications: string[];
  operationalNetwork: string;
};

interface OrganizationStepProps {
  data: OrganizationDetails;
  statutoryData: StatutoryDetails;
  onNext: (data: { organization: OrganizationDetails; statutory: StatutoryDetails }) => void;
}

export function OrganizationStep({ data, statutoryData, onNext }: OrganizationStepProps) {
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
      productCategoriesOther: data?.productCategoriesOther || '',
      entityType: statutoryData?.entityType || '',
      firmRegistrationNo: statutoryData?.firmRegistrationNo || '',
      pfNumber: statutoryData?.pfNumber || '',
      esiNumber: statutoryData?.esiNumber || '',
      iecNo: statutoryData?.iecNo || '',
      labourPermitNo: statutoryData?.labourPermitNo || '',
      memberships: statutoryData?.memberships || [],
      enlistments: statutoryData?.enlistments || [],
      certifications: statutoryData?.certifications || [],
      operationalNetwork: statutoryData?.operationalNetwork || '',
    },
  });

  const selectedCategories = watch('productCategories') || [];
  const showOtherInput = selectedCategories.includes('Others');

  const handleFormSubmit = (values: FormValues) => {
    const includesOthers = values.productCategories?.includes('Others');
    const organization: OrganizationDetails = {
      buyerCompanyId: values.buyerCompanyId,
      legalName: values.legalName,
      tradeName: values.tradeName || '',
      industryType: values.industryType,
      organizationType: values.organizationType,
      ownershipType: values.ownershipType,
      productCategories: values.productCategories,
      productCategoriesOther: includesOthers ? (values.productCategoriesOther || '').trim() : '',
    };
    const statutory: StatutoryDetails = {
      ...statutoryData,
      entityType: values.entityType,
      firmRegistrationNo: values.firmRegistrationNo || '',
      pfNumber: values.pfNumber || '',
      esiNumber: values.esiNumber || '',
      iecNo: values.iecNo || '',
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
            <Label>Buyer Company *</Label>
            <Controller
              name="buyerCompanyId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingCompanies}>
                  <SelectTrigger className={errors.buyerCompanyId ? 'border-destructive' : ''}>
                    {isLoadingCompanies ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading companies...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select buyer company" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {buyerCompanies?.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name} ({company.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
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
            <Label>Product/Service Categories *</Label>
            <Controller
              name="productCategories"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={PRODUCT_CATEGORIES.map((cat) => ({ label: cat, value: cat }))}
                  selected={field.value}
                  onChange={field.onChange}
                  placeholder="Select product/service categories"
                />
              )}
            />
            {errors.productCategories && (
              <p className="text-xs text-destructive">{errors.productCategories.message}</p>
            )}
          </div>

          {showOtherInput && (
            <div className="grid gap-1.5">
              <Label htmlFor="productCategoriesOther">
                Please specify other category/service <span className="text-destructive">*</span>
              </Label>
              <Input
                id="productCategoriesOther"
                {...register('productCategoriesOther')}
                placeholder="e.g. Drone surveying, Software licensing"
                className={errors.productCategoriesOther ? 'border-destructive' : ''}
              />
              {errors.productCategoriesOther && (
                <p className="text-xs text-destructive">{errors.productCategoriesOther.message as string}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Statutory & Registrations (moved from Commercial Details) */}
      <div className="form-section">
        <h3 className="form-section-title">
          <FileCheck className="h-5 w-5 text-primary" />
          Statutory & Registrations
        </h3>

        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label>Entity Type *</Label>
              <Controller
                name="entityType"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className={errors.entityType ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select entity type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.entityType && (
                <p className="text-xs text-destructive">{errors.entityType.message}</p>
              )}
            </div>
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

          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="iecNo">IEC No. (Import/Export)</Label>
              <Input id="iecNo" {...register('iecNo')} placeholder="IEC Number" />
            </div>
            <div className="grid gap-1.5">
              <Label>Operational Network</Label>
              <Controller
                name="operationalNetwork"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select operational network" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATIONAL_NETWORKS.map((network) => (
                        <SelectItem key={network} value={network}>{network}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
