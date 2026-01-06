import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OrganizationDetails, INDUSTRY_TYPES, PRODUCT_CATEGORIES, INDIAN_STATES } from '@/types/vendor';
import { ChevronRight } from 'lucide-react';

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

  const handleCategoryToggle = (category: string) => {
    const updated = selectedCategories.includes(category)
      ? selectedCategories.filter((c) => c !== category)
      : [...selectedCategories, category];
    setValue('productCategories', updated);
  };

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">Organization Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="legalName">Legal Name (as per GST) *</Label>
            <Input
              id="legalName"
              {...register('legalName')}
              placeholder="Enter company legal name"
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industryType">Type of Industry *</Label>
            <Select
              value={watch('industryType')}
              onValueChange={(value) => setValue('industryType', value)}
            >
              <SelectTrigger>
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
            {errors.industryType && (
              <p className="text-sm text-destructive">{errors.industryType.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Registered Address</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="registeredAddress">Address *</Label>
            <Input
              id="registeredAddress"
              {...register('registeredAddress')}
              placeholder="Enter full registered address"
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
            />
            {errors.registeredCity && (
              <p className="text-sm text-destructive">{errors.registeredCity.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="registeredState">State *</Label>
            <Select
              value={watch('registeredState')}
              onValueChange={(value) => setValue('registeredState', value)}
            >
              <SelectTrigger>
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
            />
            {errors.registeredPincode && (
              <p className="text-sm text-destructive">{errors.registeredPincode.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Communication Address</h3>
        
        <div className="flex items-center gap-2 mb-4">
          <Checkbox
            id="sameAsRegistered"
            checked={sameAsRegistered}
            onCheckedChange={(checked) => setValue('sameAsRegistered', !!checked)}
          />
          <Label htmlFor="sameAsRegistered" className="font-normal cursor-pointer">
            Same as Registered Address
          </Label>
        </div>

        {!sameAsRegistered && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="communicationAddress">Address</Label>
              <Input
                id="communicationAddress"
                {...register('communicationAddress')}
                placeholder="Enter communication address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="communicationCity">City</Label>
              <Input
                id="communicationCity"
                {...register('communicationCity')}
                placeholder="Enter city"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="communicationState">State</Label>
              <Select
                value={watch('communicationState')}
                onValueChange={(value) => setValue('communicationState', value)}
              >
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="communicationPincode">Pincode</Label>
              <Input
                id="communicationPincode"
                {...register('communicationPincode')}
                placeholder="Enter pincode"
                maxLength={6}
              />
            </div>
          </div>
        )}
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Product/Service Categories *</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select all categories that apply to your business
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {PRODUCT_CATEGORIES.map((category) => (
            <div
              key={category}
              className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${
                selectedCategories.includes(category)
                  ? 'bg-primary/10 border-primary'
                  : 'hover:bg-muted'
              }`}
              onClick={() => handleCategoryToggle(category)}
            >
              <Checkbox
                checked={selectedCategories.includes(category)}
                className="pointer-events-none"
              />
              <span className="text-sm">{category}</span>
            </div>
          ))}
        </div>
        {errors.productCategories && (
          <p className="text-sm text-destructive mt-2">{errors.productCategories.message}</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" className="gap-2">
          Next Step
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
