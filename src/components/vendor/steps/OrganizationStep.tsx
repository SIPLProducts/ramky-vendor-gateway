import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Building2 } from 'lucide-react';
import { 
  OrganizationDetails, 
  INDUSTRY_TYPES, 
  ORGANIZATION_TYPES,
  OWNERSHIP_TYPES,
  PRODUCT_CATEGORIES 
} from '@/types/vendor';

const schema = z.object({
  legalName: z.string().min(2, 'Legal name is required'),
  tradeName: z.string().optional(),
  industryType: z.string().min(1, 'Industry type is required'),
  organizationType: z.string().min(1, 'Organization type is required'),
  ownershipType: z.string().min(1, 'Ownership type is required'),
  productCategories: z.array(z.string()).min(1, 'Select at least one product category'),
});

interface OrganizationStepProps {
  data: OrganizationDetails;
  onNext: (data: OrganizationDetails) => void;
}

export function OrganizationStep({ data, onNext }: OrganizationStepProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<OrganizationDetails>({
    resolver: zodResolver(schema),
    defaultValues: data,
  });

  return (
    <form id="step-form" onSubmit={handleSubmit(onNext)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">
          <Building2 className="h-5 w-5 text-primary" />
          Organization Profile
        </h3>

        <div className="grid gap-5">
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
        </div>
      </div>
    </form>
  );
}
