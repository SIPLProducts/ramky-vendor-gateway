import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Landmark } from 'lucide-react';
import { InternationalBankDetails } from '@/types/vendor';
import { useSapMasterData } from '@/hooks/useSapMasterData';

interface Props {
  data: InternationalBankDetails;
  onSubmit: (data: InternationalBankDetails) => void;
  onLiveUpdate?: (data: InternationalBankDetails) => void;
}

export function IntlBankDetailsStep({ data, onSubmit, onLiveUpdate }: Props) {
  const { register, control, handleSubmit, watch } = useForm<InternationalBankDetails>({
    defaultValues: data,
  });

  const { data: countries } = useSapMasterData('country');
  const hasCountries = !!(countries && countries.length > 0);

  useEffect(() => {
    const sub = watch((vals) => onLiveUpdate?.(vals as InternationalBankDetails));
    return () => sub.unsubscribe();
  }, [watch, onLiveUpdate]);

  return (
    <form id="step-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">
          <Landmark className="h-5 w-5 text-primary" />
          Company Bank Details
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          All fields below are optional. Fill in whatever is available and continue.
        </p>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input id="accountNumber" {...register('accountNumber')} placeholder="Account number" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="swiftCode">SWIFT Code</Label>
            <Input id="swiftCode" {...register('swiftCode')} placeholder="e.g. CITIUS33" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="companyName">Company Name</Label>
            <Input id="companyName" {...register('companyName')} placeholder="Account holder / company name" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bankName">Bank Name</Label>
            <Input id="bankName" {...register('bankName')} placeholder="Bank name" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bankBranch">Bank Branch</Label>
            <Input id="bankBranch" {...register('bankBranch')} placeholder="Branch" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ibanNumber">IBAN Number</Label>
            <Input
              id="ibanNumber"
              {...register('ibanNumber', {
                setValueAs: (v: string) => (v || '').toUpperCase().replace(/\s+/g, ''),
              })}
              placeholder="e.g. GB29NWBK60161331926819"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Bank Country (From SAP)</Label>
            <Controller
              name="bankCountry"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || ''}
                  onValueChange={field.onChange}
                  disabled={!hasCountries}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={hasCountries ? 'Select country' : 'No SAP values — sync SAP master data'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(countries || []).map((c) => (
                      <SelectItem key={c.id} value={c.code}>
                        {c.code}{c.description ? ` — ${c.description}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {!hasCountries && (
              <p className="text-xs text-muted-foreground">No SAP values — sync SAP master data.</p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
