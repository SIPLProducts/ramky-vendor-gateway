import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { MapPin, Building, Globe } from 'lucide-react';
import { AddressDetails, INDIAN_STATES } from '@/types/vendor';
import { useEffect } from 'react';

const schema = z.object({
  registeredAddress: z.string().min(5, 'Address is required'),
  registeredAddressLine2: z.string().optional(),
  registeredAddressLine3: z.string().optional(),
  registeredCity: z.string().min(2, 'City is required'),
  registeredState: z.string().min(2, 'State is required'),
  registeredPincode: z.string().regex(/^\d{6}$/, 'Valid 6-digit pincode required'),
  registeredPhone: z.string().optional(),
  registeredFax: z.string().optional(),
  registeredWebsite: z.string().optional(),
  
  sameAsRegistered: z.boolean(),
  manufacturingAddress: z.string().optional(),
  manufacturingAddressLine2: z.string().optional(),
  manufacturingAddressLine3: z.string().optional(),
  manufacturingCity: z.string().optional(),
  manufacturingState: z.string().optional(),
  manufacturingPincode: z.string().optional(),
  manufacturingPhone: z.string().optional(),
  manufacturingFax: z.string().optional(),
  
  branchName: z.string().optional(),
  branchAddress: z.string().optional(),
  branchCity: z.string().optional(),
  branchState: z.string().optional(),
  branchPincode: z.string().optional(),
  branchCountry: z.string().optional(),
  branchWebsite: z.string().optional(),
  branchContactName: z.string().optional(),
  branchContactDesignation: z.string().optional(),
  branchContactEmail: z.string().optional(),
  branchContactPhone: z.string().optional(),
  branchContactFax: z.string().optional(),
});

interface AddressStepProps {
  data: AddressDetails;
  onNext: (data: AddressDetails) => void;
  onBack: () => void;
}

export function AddressStep({ data, onNext, onBack }: AddressStepProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddressDetails>({
    resolver: zodResolver(schema),
    defaultValues: data,
  });

  const sameAsRegistered = watch('sameAsRegistered');
  const registeredAddress = watch('registeredAddress');
  const registeredAddressLine2 = watch('registeredAddressLine2');
  const registeredAddressLine3 = watch('registeredAddressLine3');
  const registeredCity = watch('registeredCity');
  const registeredState = watch('registeredState');
  const registeredPincode = watch('registeredPincode');

  useEffect(() => {
    if (sameAsRegistered) {
      setValue('manufacturingAddress', registeredAddress);
      setValue('manufacturingAddressLine2', registeredAddressLine2);
      setValue('manufacturingAddressLine3', registeredAddressLine3);
      setValue('manufacturingCity', registeredCity);
      setValue('manufacturingState', registeredState);
      setValue('manufacturingPincode', registeredPincode);
    }
  }, [sameAsRegistered, registeredAddress, registeredAddressLine2, registeredAddressLine3, registeredCity, registeredState, registeredPincode, setValue]);

  return (
    <form id="step-form" onSubmit={handleSubmit(onNext)} className="space-y-6">
      {/* Registered/Corporate Office Address */}
      <div className="form-section">
        <h3 className="form-section-title">
          <MapPin className="h-5 w-5 text-primary" />
          Registered / Corporate Office Address
        </h3>

        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="registeredAddress">Address Line 1 *</Label>
            <Input
              id="registeredAddress"
              {...register('registeredAddress')}
              placeholder="Building name, street address"
              className={errors.registeredAddress ? 'border-destructive' : ''}
            />
            {errors.registeredAddress && (
              <p className="text-xs text-destructive">{errors.registeredAddress.message}</p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="registeredAddressLine2">Address Line 2</Label>
              <Input
                id="registeredAddressLine2"
                {...register('registeredAddressLine2')}
                placeholder="Area, locality"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="registeredAddressLine3">Address Line 3</Label>
              <Input
                id="registeredAddressLine3"
                {...register('registeredAddressLine3')}
                placeholder="Landmark (optional)"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="registeredCity">City *</Label>
              <Input
                id="registeredCity"
                {...register('registeredCity')}
                placeholder="City"
                className={errors.registeredCity ? 'border-destructive' : ''}
              />
              {errors.registeredCity && (
                <p className="text-xs text-destructive">{errors.registeredCity.message}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label>State *</Label>
              <Controller
                name="registeredState"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className={errors.registeredState ? 'border-destructive' : ''}>
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
                <p className="text-xs text-destructive">{errors.registeredState.message}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="registeredPincode">PIN Code *</Label>
              <Input
                id="registeredPincode"
                {...register('registeredPincode')}
                placeholder="6-digit PIN"
                maxLength={6}
                className={errors.registeredPincode ? 'border-destructive' : ''}
              />
              {errors.registeredPincode && (
                <p className="text-xs text-destructive">{errors.registeredPincode.message}</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="registeredPhone">Office Phone</Label>
              <Input
                id="registeredPhone"
                {...register('registeredPhone')}
                placeholder="Office phone number"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="registeredFax">Fax</Label>
              <Input
                id="registeredFax"
                {...register('registeredFax')}
                placeholder="Fax number"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="registeredWebsite">Website</Label>
              <Input
                id="registeredWebsite"
                {...register('registeredWebsite')}
                placeholder="www.company.com"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Manufacturing Unit Address */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Building className="h-5 w-5 text-primary" />
          Manufacturing Unit / Other Units Address
        </h3>

        <div className="flex items-center space-x-2 mb-5">
          <Controller
            name="sameAsRegistered"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="sameAsRegistered"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Label htmlFor="sameAsRegistered" className="font-normal cursor-pointer">
            Same as registered office address
          </Label>
        </div>

        {!sameAsRegistered && (
          <div className="grid gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="manufacturingAddress">Address Line 1</Label>
              <Input
                id="manufacturingAddress"
                {...register('manufacturingAddress')}
                placeholder="Building name, street address"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="manufacturingAddressLine2">Address Line 2</Label>
                <Input
                  id="manufacturingAddressLine2"
                  {...register('manufacturingAddressLine2')}
                  placeholder="Area, locality"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="manufacturingAddressLine3">Address Line 3</Label>
                <Input
                  id="manufacturingAddressLine3"
                  {...register('manufacturingAddressLine3')}
                  placeholder="Landmark"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="manufacturingCity">City</Label>
                <Input
                  id="manufacturingCity"
                  {...register('manufacturingCity')}
                  placeholder="City"
                />
              </div>

              <div className="grid gap-1.5">
                <Label>State</Label>
                <Controller
                  name="manufacturingState"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
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
                  )}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="manufacturingPincode">PIN Code</Label>
                <Input
                  id="manufacturingPincode"
                  {...register('manufacturingPincode')}
                  placeholder="6-digit PIN"
                  maxLength={6}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="manufacturingPhone">Office Phone</Label>
                <Input
                  id="manufacturingPhone"
                  {...register('manufacturingPhone')}
                  placeholder="Office phone number"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="manufacturingFax">Fax</Label>
                <Input
                  id="manufacturingFax"
                  {...register('manufacturingFax')}
                  placeholder="Fax number"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Branch Details */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Globe className="h-5 w-5 text-primary" />
          Branch Details (Optional)
        </h3>

        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="branchName">Branch Name</Label>
              <Input
                id="branchName"
                {...register('branchName')}
                placeholder="Name of branch"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="branchWebsite">Website</Label>
              <Input
                id="branchWebsite"
                {...register('branchWebsite')}
                placeholder="Branch website"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="branchAddress">Address</Label>
            <Input
              id="branchAddress"
              {...register('branchAddress')}
              placeholder="Branch address"
            />
          </div>

          <div className="grid md:grid-cols-4 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="branchCity">City</Label>
              <Input
                id="branchCity"
                {...register('branchCity')}
                placeholder="City"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="branchState">State</Label>
              <Input
                id="branchState"
                {...register('branchState')}
                placeholder="State"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="branchPincode">PIN Code</Label>
              <Input
                id="branchPincode"
                {...register('branchPincode')}
                placeholder="PIN"
                maxLength={6}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="branchCountry">Country</Label>
              <Input
                id="branchCountry"
                {...register('branchCountry')}
                placeholder="Country"
                defaultValue="India"
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-2">
            <p className="text-sm font-medium text-foreground mb-4">Branch Contact Person</p>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="branchContactName">Name</Label>
                <Input
                  id="branchContactName"
                  {...register('branchContactName')}
                  placeholder="Contact person name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="branchContactDesignation">Designation</Label>
                <Input
                  id="branchContactDesignation"
                  {...register('branchContactDesignation')}
                  placeholder="Designation"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5 mt-4">
              <div className="grid gap-1.5">
                <Label htmlFor="branchContactEmail">Email</Label>
                <Input
                  id="branchContactEmail"
                  type="email"
                  {...register('branchContactEmail')}
                  placeholder="email@example.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="branchContactPhone">Phone</Label>
                <Input
                  id="branchContactPhone"
                  {...register('branchContactPhone')}
                  placeholder="Phone number"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="branchContactFax">Fax</Label>
                <Input
                  id="branchContactFax"
                  {...register('branchContactFax')}
                  placeholder="Fax number"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
