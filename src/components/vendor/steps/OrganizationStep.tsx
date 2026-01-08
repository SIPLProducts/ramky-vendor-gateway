import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OrganizationDetails, INDUSTRY_TYPES, PRODUCT_CATEGORIES, INDIAN_STATES } from '@/types/vendor';
import { Building2, MapPin, Mail, Package } from 'lucide-react';

// Convert PRODUCT_CATEGORIES to MultiSelect options format
const categoryOptions = PRODUCT_CATEGORIES.map((category) => ({
  label: category,
  value: category,
}));

const schema = z.object({
  legalName: z.string().min(3, 'Legal name must be at least 3 characters'),
  tradeName: z.string().optional(),
  registeredAddress: z.string().min(10, 'Address must be at least 10 characters'),
  registeredCity: z.string().min(2, 'City is required'),
  registeredState: z.string().min(1, 'State is required'),
  registeredPincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  communicationAddress: z.string().optional(),
  communicationCity: z.string().optional(),
  communicationState: z.string().optional(),
  communicationPincode: z.string().optional(),
  sameAsRegistered: z.boolean(),
  industryType: z.string().min(1, 'Industry type is required'),
  productCategories: z.array(z.string()).min(1, 'Select at least one category'),
});

interface OrganizationStepProps {
  data: OrganizationDetails;
  onNext: (data: OrganizationDetails) => void;
}

export function OrganizationStep({ data, onNext }: OrganizationStepProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<OrganizationDetails>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...data,
      productCategories: data.productCategories || [],
    },
  });

  const sameAsRegistered = watch('sameAsRegistered');
  const selectedCategories = watch('productCategories') ?? [];

  return (
    <form id="step-form" onSubmit={handleSubmit(onNext)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">
          <Building2 className="h-5 w-5 text-primary" />
          Organization Details
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="legalName">Legal Name (as per GST) *</Label>
            <Input
              id="legalName"
              {...register('legalName')}
              placeholder="Enter company legal name"
              className="focus-enterprise"
            />
            {errors.legalName && (
              <p className="text-sm text-destructive">{errors.legalName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tradeName">Trade Name</Label>
            <Input
              id="tradeName"
              {...register('tradeName')}
              placeholder="Enter trade name (if different)"
              className="focus-enterprise"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industryType">Type of Industry *</Label>
            <Controller
              name="industryType"
              control={control}
              render={({ field: { ref, ...fieldProps } }) => (
                <Select value={fieldProps.value} onValueChange={fieldProps.onChange}>
                  <SelectTrigger className="focus-enterprise">
                    <SelectValue placeholder="Select industry type" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.industryType && (
              <p className="text-sm text-destructive">{errors.industryType.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">
          <MapPin className="h-5 w-5 text-primary" />
          Registered Address
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="registeredAddress">Address *</Label>
            <Input
              id="registeredAddress"
              {...register('registeredAddress')}
              placeholder="Enter full registered address"
              className="focus-enterprise"
            />
            {errors.registeredAddress && (
              <p className="text-sm text-destructive">{errors.registeredAddress.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="registeredCity">City *</Label>
            <Input
              id="registeredCity"
              {...register('registeredCity')}
              placeholder="Enter city"
              className="focus-enterprise"
            />
            {errors.registeredCity && (
              <p className="text-sm text-destructive">{errors.registeredCity.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="registeredState">State *</Label>
            <Controller
              name="registeredState"
              control={control}
              render={({ field: { ref, ...fieldProps } }) => (
                <Select value={fieldProps.value} onValueChange={fieldProps.onChange}>
                  <SelectTrigger className="focus-enterprise">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.registeredState && (
              <p className="text-sm text-destructive">{errors.registeredState.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="registeredPincode">Pincode *</Label>
            <Input
              id="registeredPincode"
              {...register('registeredPincode')}
              placeholder="Enter 6-digit pincode"
              maxLength={6}
              className="focus-enterprise"
            />
            {errors.registeredPincode && (
              <p className="text-sm text-destructive">{errors.registeredPincode.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">
          <Mail className="h-5 w-5 text-primary" />
          Communication Address
        </h3>
        
        <div className="flex items-center gap-2 mb-5 p-3 bg-muted rounded-lg">
          <Checkbox
            id="sameAsRegistered"
            checked={sameAsRegistered}
            onCheckedChange={(checked) => setValue('sameAsRegistered', !!checked)}
          />
          <Label htmlFor="sameAsRegistered" className="font-normal cursor-pointer text-sm">
            Same as Registered Address
          </Label>
        </div>

        {!sameAsRegistered && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="communicationAddress">Address</Label>
              <Input
                id="communicationAddress"
                {...register('communicationAddress')}
                placeholder="Enter communication address"
                className="focus-enterprise"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="communicationCity">City</Label>
              <Input
                id="communicationCity"
                {...register('communicationCity')}
                placeholder="Enter city"
                className="focus-enterprise"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="communicationState">State</Label>
              <Controller
                name="communicationState"
                control={control}
                render={({ field: { ref, ...fieldProps } }) => (
                  <Select value={fieldProps.value} onValueChange={fieldProps.onChange}>
                    <SelectTrigger className="focus-enterprise">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="communicationPincode">Pincode</Label>
              <Input
                id="communicationPincode"
                {...register('communicationPincode')}
                placeholder="Enter pincode"
                maxLength={6}
                className="focus-enterprise"
              />
            </div>
          </div>
        )}
      </div>

      <div className="form-section">
        <h3 className="form-section-title">
          <Package className="h-5 w-5 text-primary" />
          Product/Service Categories *
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select all categories that apply to your business
        </p>
        
        <MultiSelect
          options={categoryOptions}
          selected={selectedCategories}
          onChange={(selected) => setValue('productCategories', selected, { shouldValidate: true })}
          placeholder="Select categories..."
        />
        {errors.productCategories && (
          <p className="text-sm text-destructive mt-2">{errors.productCategories.message}</p>
        )}
      </div>
    </form>
  );
}
