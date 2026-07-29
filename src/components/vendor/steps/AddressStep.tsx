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
import { useEffect, useRef } from 'react';
import { digitsOnly } from '@/lib/utils';
import { toast } from 'sonner';


const optionalPhone = z
  .string()
  .optional()
  .refine((v) => !v || /^\d{10}$/.test(v), { message: '10-digit mobile number required' });
const optionalPincode = z
  .string()
  .optional()
  .refine((v) => !v || /^\d{6}$/.test(v), { message: 'Valid 6-digit pincode required' });
const numericInput = (max: number) => ({
  inputMode: 'numeric' as const,
  pattern: '\\d*',
  maxLength: max,
});

const optionalEmail = z
  .string()
  .trim()
  .max(100, 'Email must be less than 100 characters')
  .email('Valid email required')
  .optional()
  .or(z.literal(''));

const schema = z.object({
  registeredAddress: z.string().min(5, 'Address is required').max(40, 'Maximum 40 characters allowed'),
  registeredAddressLine2: z.string().max(40, 'Maximum 40 characters allowed').optional(),
  registeredAddressLine3: z.string().max(40, 'Maximum 40 characters allowed').optional(),
  registeredAddressLine4: z.string().max(40, 'Maximum 40 characters allowed').optional(),
  registeredCity: z.string().min(2, 'City is required'),
  registeredState: z.string().min(2, 'State is required'),
  registeredPincode: z.string().regex(/^\d{6}$/, 'Valid 6-digit pincode required'),
  registeredPhone: optionalPhone,
  registeredFax: z.string().optional(),
  registeredWebsite: z.string().optional(),
  registeredEmail: z
    .string()
    .trim()
    .min(1, 'Email 1 is required')
    .email('Valid email required')
    .max(100, 'Email must be less than 100 characters'),
  registeredContact1: z
    .string()
    .min(1, 'Contact 1 is required')
    .regex(/^\d{10}$/, '10-digit mobile number required'),
  registeredContact2: optionalPhone,
  registeredEmail2: optionalEmail,

  sameAsRegistered: z.boolean(),
  manufacturingAddress: z.string().max(40, 'Maximum 40 characters allowed').optional(),
  manufacturingAddressLine2: z.string().max(40, 'Maximum 40 characters allowed').optional(),
  manufacturingAddressLine3: z.string().max(40, 'Maximum 40 characters allowed').optional(),
  manufacturingAddressLine4: z.string().max(40, 'Maximum 40 characters allowed').optional(),
  manufacturingCity: z.string().optional(),
  manufacturingState: z.string().optional(),
  manufacturingPincode: optionalPincode,
  manufacturingPhone: optionalPhone,
  manufacturingFax: z.string().optional(),
  manufacturingEmail: optionalEmail,

  branchName: z.string().optional(),
  branchAddress: z.string().max(40, 'Maximum 40 characters allowed').optional(),
  branchAddressLine2: z.string().max(40, 'Maximum 40 characters allowed').optional(),
  branchAddressLine3: z.string().max(40, 'Maximum 40 characters allowed').optional(),
  branchAddressLine4: z.string().max(40, 'Maximum 40 characters allowed').optional(),
  branchCity: z.string().optional(),
  branchState: z.string().optional(),
  branchPincode: optionalPincode,
  branchCountry: z.string().optional(),
  branchWebsite: z.string().optional(),
  branchEmail: optionalEmail,
  branchContactName: z.string().optional(),
  branchContactDesignation: z.string().optional(),
  branchContactEmail: z.string().optional(),
  branchContactPhone: optionalPhone,
  branchContactFax: z.string().optional(),
});

interface AddressStepProps {
  data: AddressDetails;
  tenantId?: string | null;
  /** Bumped by the parent when a GST identity change happens; forces the
   *  form to drop dirty values and accept the newly cleared parent state. */
  resetKey?: number;
  onNext: (data: AddressDetails) => void;
  onBack: () => void;
}

export function AddressStep({ data, tenantId: _tenantId, resetKey, onNext, onBack }: AddressStepProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AddressDetails>({
    resolver: zodResolver(schema),
    defaultValues: data,
    values: data,
    resetOptions: { keepDirtyValues: true, keepDirty: true },
  });

  // Force-accept the parent-cleared values when a GST identity change fires.
  const prevResetKeyRef = useRef<number | undefined>(resetKey);
  useEffect(() => {
    if (resetKey !== undefined && prevResetKeyRef.current !== undefined && resetKey !== prevResetKeyRef.current) {
      reset(data, { keepDirtyValues: false, keepDirty: false });
    }
    prevResetKeyRef.current = resetKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Wrap register() so phone/pincode inputs strip non-digits + clamp length.
  const numericField = (name: keyof AddressDetails, max: number) => ({
    ...register(name as any, {
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = digitsOnly(e.target.value, max);
        if (v !== e.target.value) setValue(name as any, v as any, { shouldValidate: false });
      },
    }),
    ...numericInput(max),
  });

  const sameAsRegistered = watch('sameAsRegistered');
  const registeredAddress = watch('registeredAddress');
  const registeredAddressLine2 = watch('registeredAddressLine2');
  const registeredAddressLine3 = watch('registeredAddressLine3');
  const registeredAddressLine4 = watch('registeredAddressLine4');
  const registeredCity = watch('registeredCity');
  const registeredState = watch('registeredState');
  const registeredPincode = watch('registeredPincode');
  const registeredEmail = watch('registeredEmail');

  // Split a long Address Line 1 into Lines 1-4 (max 40 chars each), preferring
  // word boundaries within each 40-char window so words aren't cut mid-word.
  const splitAddressIntoLines = (raw: string): [string, string, string, string] => {
    const text = (raw || '').replace(/\s+/g, ' ').trimStart();
    const chunks: string[] = [];
    let rest = text;
    while (rest.length > 0 && chunks.length < 4) {
      if (rest.length <= 40) {
        chunks.push(rest);
        rest = '';
        break;
      }
      let cut = 40;
      const window = rest.slice(0, 40);
      const lastSpace = window.lastIndexOf(' ');
      if (lastSpace > 0 && lastSpace >= 20) cut = lastSpace;
      chunks.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }
    return [chunks[0] || '', chunks[1] || '', chunks[2] || '', chunks[3] || ''];
  };

  const handleAddressLine1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const [l1, l2, l3, l4] = splitAddressIntoLines(raw);
    setValue('registeredAddress', l1, { shouldValidate: true, shouldDirty: true });
    // Only overwrite downstream lines once overflow actually occurs, so a user
    // typing their own Line 2-4 values doesn't get wiped by short Line 1 edits.
    if (raw.length > 40 || l2) {
      setValue('registeredAddressLine2', l2, { shouldValidate: true, shouldDirty: true });
      setValue('registeredAddressLine3', l3, { shouldValidate: true, shouldDirty: true });
      setValue('registeredAddressLine4', l4, { shouldValidate: true, shouldDirty: true });
    }
  };

  // On mount (or when the incoming `data` identity changes), if any address
  // Line 1 arrives pre-populated with > 40 chars and the downstream lines are
  // empty, cascade the overflow into Lines 2-4 so validation passes and the
  // user sees the same layout that live typing produces.
  useEffect(() => {
    const cascade = (
      key: 'registered' | 'manufacturing' | 'branch',
    ) => {
      const baseField = key === 'registered'
        ? 'registeredAddress'
        : key === 'manufacturing'
          ? 'manufacturingAddress'
          : 'branchAddress';
      const l2Field = `${baseField}Line2` as keyof AddressDetails;
      const l3Field = `${baseField}Line3` as keyof AddressDetails;
      const l4Field = `${baseField}Line4` as keyof AddressDetails;
      const raw = (data as any)?.[baseField] as string | undefined;
      if (!raw || raw.length <= 40) return;
      if ((data as any)?.[l2Field] || (data as any)?.[l3Field] || (data as any)?.[l4Field]) return;
      const [l1, l2, l3, l4] = splitAddressIntoLines(raw);
      setValue(baseField as any, l1, { shouldValidate: true, shouldDirty: true });
      setValue(l2Field as any, l2 as any, { shouldValidate: true, shouldDirty: true });
      setValue(l3Field as any, l3 as any, { shouldValidate: true, shouldDirty: true });
      setValue(l4Field as any, l4 as any, { shouldValidate: true, shouldDirty: true });
    };
    cascade('registered');
    cascade('manufacturing');
    cascade('branch');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (sameAsRegistered) {
      setValue('manufacturingAddress', registeredAddress);
      setValue('manufacturingAddressLine2', registeredAddressLine2);
      setValue('manufacturingAddressLine3', registeredAddressLine3);
      setValue('manufacturingAddressLine4', registeredAddressLine4);
      setValue('manufacturingCity', registeredCity);
      setValue('manufacturingState', registeredState);
      setValue('manufacturingPincode', registeredPincode);
      setValue('manufacturingEmail', registeredEmail);
    }
  }, [sameAsRegistered, registeredAddress, registeredAddressLine2, registeredAddressLine3, registeredAddressLine4, registeredCity, registeredState, registeredPincode, registeredEmail, setValue]);


  return (
    <form id="step-form" onSubmit={handleSubmit(onNext, (errs) => {
      const firstKey = Object.keys(errs || {})[0];
      const firstMsg = firstKey ? ((errs as any)[firstKey]?.message as string) : 'Please complete the required address fields.';
      toast.error(firstMsg || 'Please complete the required address fields.');
      if (firstKey) {
        const el = document.getElementById(firstKey) || document.querySelector(`[name="${firstKey}"]`);
        (el as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    })} className="vendor-styled-form space-y-6">


      {/* Registered/Corporate Office Address */}
      <div className="form-section">
        <h3 className="form-section-title">
          <MapPin className="h-5 w-5 text-primary" />
          Registered / Corporate Office Address
        </h3>

        <div className="grid gap-5">
          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="registeredAddress">Address Line 1 *</Label>
              <Input
                id="registeredAddress"
                value={registeredAddress || ''}
                onChange={handleAddressLine1Change}
                placeholder="Building name, street address (overflow auto-flows into Lines 2-4)"
                maxLength={160}
                data-required
                className={errors.registeredAddress ? 'border-destructive' : ''}
              />
              <p className="text-xs text-muted-foreground">
                Text beyond 40 characters automatically flows into Address Line 2, 3 and 4.
              </p>
              {errors.registeredAddress && (
                <p className="text-xs text-destructive">{errors.registeredAddress.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="registeredAddressLine2">Address Line 2</Label>
              <Input
                id="registeredAddressLine2"
                {...register('registeredAddressLine2')}
                placeholder="Area, locality"
                maxLength={40}
                className={errors.registeredAddressLine2 ? 'border-destructive' : ''}
              />
              {errors.registeredAddressLine2 && (
                <p className="text-xs text-destructive">{errors.registeredAddressLine2.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="registeredAddressLine3">Address Line 3</Label>
              <Input
                id="registeredAddressLine3"
                {...register('registeredAddressLine3')}
                placeholder="Landmark (optional)"
                maxLength={40}
                className={errors.registeredAddressLine3 ? 'border-destructive' : ''}
              />
              {errors.registeredAddressLine3 && (
                <p className="text-xs text-destructive">{errors.registeredAddressLine3.message}</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="registeredAddressLine4">Address Line 4</Label>
              <Input
                id="registeredAddressLine4"
                {...register('registeredAddressLine4')}
                placeholder="Additional detail (optional)"
                maxLength={40}
                className={errors.registeredAddressLine4 ? 'border-destructive' : ''}
              />
              {errors.registeredAddressLine4 && (
                <p className="text-xs text-destructive">{errors.registeredAddressLine4.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="registeredCity">City *</Label>
              <Input
                id="registeredCity"
                {...register('registeredCity')}
                placeholder="City"
                data-required
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
                    <SelectTrigger data-required className={errors.registeredState ? 'border-destructive' : ''}>
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
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="registeredPincode">PIN Code *</Label>
              <Input
                id="registeredPincode"
                {...numericField('registeredPincode', 6)}
                placeholder="6-digit PIN"
                data-required
                className={errors.registeredPincode ? 'border-destructive' : ''}
              />
              {errors.registeredPincode && (
                <p className="text-xs text-destructive">{errors.registeredPincode.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="registeredPhone">Office Phone</Label>
              <Input
                id="registeredPhone"
                {...numericField('registeredPhone', 10)}
                placeholder="10-digit mobile number"
                className={errors.registeredPhone ? 'border-destructive' : ''}
              />
              {errors.registeredPhone && (
                <p className="text-xs text-destructive">{errors.registeredPhone.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="registeredFax">Fax</Label>
              <Input
                id="registeredFax"
                {...register('registeredFax')}
                placeholder="Fax number"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="registeredWebsite">Website</Label>
              <Input
                id="registeredWebsite"
                {...register('registeredWebsite')}
                placeholder="www.company.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="registeredEmail">Email 1 *</Label>
              <Input
                id="registeredEmail"
                type="email"
                {...register('registeredEmail')}
                placeholder="contact@company.com"
                data-required
                className={errors.registeredEmail ? 'border-destructive' : ''}
              />
              {errors.registeredEmail && (
                <p className="text-xs text-destructive">{errors.registeredEmail.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="registeredEmail2">Email 2</Label>
              <Input
                id="registeredEmail2"
                type="email"
                {...register('registeredEmail2')}
                placeholder="alternate@company.com (optional)"
                className={errors.registeredEmail2 ? 'border-destructive' : ''}
              />
              {errors.registeredEmail2 && (
                <p className="text-xs text-destructive">{errors.registeredEmail2.message}</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="registeredContact1">Contact 1 *</Label>
              <Input
                id="registeredContact1"
                {...numericField('registeredContact1', 10)}
                placeholder="10-digit mobile number"
                data-required
                className={errors.registeredContact1 ? 'border-destructive' : ''}
              />
              {errors.registeredContact1 && (
                <p className="text-xs text-destructive">{errors.registeredContact1.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="registeredContact2">Contact 2</Label>
              <Input
                id="registeredContact2"
                {...numericField('registeredContact2', 10)}
                placeholder="10-digit mobile number (optional)"
                className={errors.registeredContact2 ? 'border-destructive' : ''}
              />
              {errors.registeredContact2 && (
                <p className="text-xs text-destructive">{errors.registeredContact2.message}</p>
              )}
            </div>
            <div />
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
            <div className="grid md:grid-cols-3 gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="manufacturingAddress">Address Line 1</Label>
                <Input
                  id="manufacturingAddress"
                  {...register('manufacturingAddress')}
                  placeholder="Building name, street address"
                  maxLength={40}
                  className={errors.manufacturingAddress ? 'border-destructive' : ''}
                />
                {errors.manufacturingAddress && (
                  <p className="text-xs text-destructive">{errors.manufacturingAddress.message}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="manufacturingAddressLine2">Address Line 2</Label>
                <Input
                  id="manufacturingAddressLine2"
                  {...register('manufacturingAddressLine2')}
                  placeholder="Area, locality"
                  maxLength={40}
                  className={errors.manufacturingAddressLine2 ? 'border-destructive' : ''}
                />
                {errors.manufacturingAddressLine2 && (
                  <p className="text-xs text-destructive">{errors.manufacturingAddressLine2.message}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="manufacturingAddressLine3">Address Line 3</Label>
                <Input
                  id="manufacturingAddressLine3"
                  {...register('manufacturingAddressLine3')}
                  placeholder="Landmark"
                  maxLength={40}
                  className={errors.manufacturingAddressLine3 ? 'border-destructive' : ''}
                />
                {errors.manufacturingAddressLine3 && (
                  <p className="text-xs text-destructive">{errors.manufacturingAddressLine3.message}</p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="manufacturingAddressLine4">Address Line 4</Label>
                <Input
                  id="manufacturingAddressLine4"
                  {...register('manufacturingAddressLine4')}
                  placeholder="Additional detail (optional)"
                  maxLength={40}
                  className={errors.manufacturingAddressLine4 ? 'border-destructive' : ''}
                />
                {errors.manufacturingAddressLine4 && (
                  <p className="text-xs text-destructive">{errors.manufacturingAddressLine4.message}</p>
                )}
              </div>
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
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="manufacturingPincode">PIN Code</Label>
                <Input
                  id="manufacturingPincode"
                  {...numericField('manufacturingPincode', 6)}
                  placeholder="6-digit PIN"
                  className={errors.manufacturingPincode ? 'border-destructive' : ''}
                />
                {errors.manufacturingPincode && (
                  <p className="text-xs text-destructive">{errors.manufacturingPincode.message}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="manufacturingPhone">Office Phone</Label>
                <Input
                  id="manufacturingPhone"
                  {...numericField('manufacturingPhone', 10)}
                  placeholder="10-digit mobile number"
                  className={errors.manufacturingPhone ? 'border-destructive' : ''}
                />
                {errors.manufacturingPhone && (
                  <p className="text-xs text-destructive">{errors.manufacturingPhone.message}</p>
                )}
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

            <div className="grid md:grid-cols-3 gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="manufacturingEmail">Email ID</Label>
                <Input
                  id="manufacturingEmail"
                  type="email"
                  {...register('manufacturingEmail')}
                  placeholder="unit@company.com"
                  className={errors.manufacturingEmail ? 'border-destructive' : ''}
                />
                {errors.manufacturingEmail && (
                  <p className="text-xs text-destructive">{errors.manufacturingEmail.message}</p>
                )}
              </div>
              <div />
              <div />
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
          <div className="grid md:grid-cols-3 gap-5">
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
            <div className="grid gap-1.5">
              <Label htmlFor="branchEmail">Email ID</Label>
              <Input
                id="branchEmail"
                type="email"
                {...register('branchEmail')}
                placeholder="branch@company.com"
                className={errors.branchEmail ? 'border-destructive' : ''}
              />
              {errors.branchEmail && (
                <p className="text-xs text-destructive">{errors.branchEmail.message}</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="branchAddress">Address Line 1</Label>
              <Input
                id="branchAddress"
                {...register('branchAddress')}
                placeholder="Branch address"
                maxLength={40}
                className={errors.branchAddress ? 'border-destructive' : ''}
              />
              {errors.branchAddress && (
                <p className="text-xs text-destructive">{errors.branchAddress.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="branchAddressLine2">Address Line 2</Label>
              <Input
                id="branchAddressLine2"
                {...register('branchAddressLine2')}
                placeholder="Area, locality"
                maxLength={40}
                className={errors.branchAddressLine2 ? 'border-destructive' : ''}
              />
              {errors.branchAddressLine2 && (
                <p className="text-xs text-destructive">{errors.branchAddressLine2.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="branchAddressLine3">Address Line 3</Label>
              <Input
                id="branchAddressLine3"
                {...register('branchAddressLine3')}
                placeholder="Landmark"
                maxLength={40}
                className={errors.branchAddressLine3 ? 'border-destructive' : ''}
              />
              {errors.branchAddressLine3 && (
                <p className="text-xs text-destructive">{errors.branchAddressLine3.message}</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="branchAddressLine4">Address Line 4</Label>
              <Input
                id="branchAddressLine4"
                {...register('branchAddressLine4')}
                placeholder="Additional detail"
                maxLength={40}
                className={errors.branchAddressLine4 ? 'border-destructive' : ''}
              />
              {errors.branchAddressLine4 && (
                <p className="text-xs text-destructive">{errors.branchAddressLine4.message}</p>
              )}
            </div>
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
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="branchPincode">PIN Code</Label>
              <Input
                id="branchPincode"
                {...numericField('branchPincode', 6)}
                placeholder="6-digit PIN"
                className={errors.branchPincode ? 'border-destructive' : ''}
              />
              {errors.branchPincode && (
                <p className="text-xs text-destructive">{errors.branchPincode.message}</p>
              )}
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
            <div />
          </div>


          <div className="border-t pt-4 mt-2">
            <p className="text-sm font-medium text-foreground mb-4">Branch Contact Person</p>
            <div className="grid md:grid-cols-3 gap-5">
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
              <div className="grid gap-1.5">
                <Label htmlFor="branchContactEmail">Email</Label>
                <Input
                  id="branchContactEmail"
                  type="email"
                  {...register('branchContactEmail')}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5 mt-4">
              <div className="grid gap-1.5">
                <Label htmlFor="branchContactPhone">Phone</Label>
                <Input
                  id="branchContactPhone"
                  {...numericField('branchContactPhone', 10)}
                  placeholder="10-digit mobile number"
                  className={errors.branchContactPhone ? 'border-destructive' : ''}
                />
                {errors.branchContactPhone && (
                  <p className="text-xs text-destructive">{errors.branchContactPhone.message}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="branchContactFax">Fax</Label>
                <Input
                  id="branchContactFax"
                  {...register('branchContactFax')}
                  placeholder="Fax number"
                />
              </div>
              <div />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
