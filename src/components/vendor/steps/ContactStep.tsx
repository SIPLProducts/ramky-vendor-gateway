import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Users, User, Briefcase, Headphones } from 'lucide-react';
import { ContactDetails } from '@/types/vendor';
import { useBuiltInFieldOverrides, isFieldVisible } from '@/hooks/useBuiltInFieldOverrides';

const schema = z.object({
  ceoName: z.string().min(2, 'Name is required'),
  ceoDesignation: z.string().optional(),
  ceoPhone: z.string().min(10, 'Valid phone number required'),
  ceoEmail: z.string().email('Valid email required'),
  ceoPhone2: z.string().optional(),
  ceoEmail2: z.string().email('Valid email required').optional().or(z.literal('')),
  marketingName: z.string().optional(),
  marketingDesignation: z.string().optional(),
  marketingPhone: z.string().optional(),
  marketingEmail: z.string().optional(),
  productionName: z.string().optional(),
  productionDesignation: z.string().optional(),
  productionPhone: z.string().optional(),
  productionEmail: z.string().optional(),
  customerServiceName: z.string().optional(),
  customerServiceDesignation: z.string().optional(),
  customerServicePhone: z.string().optional(),
  customerServiceEmail: z.string().optional(),
});

interface ContactStepProps {
  data: ContactDetails;
  tenantId?: string | null;
  onNext: (data: ContactDetails) => void;
  onBack: () => void;
}

export function ContactStep({ data, tenantId, onNext }: ContactStepProps) {
  const overrides = useBuiltInFieldOverrides(tenantId, 'contact');
  const show = (name: string) => isFieldVisible(overrides, name);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ContactDetails>({
    resolver: zodResolver(schema),
    defaultValues: data,
  });

  // Required fields that the admin hid → seed a placeholder so zod passes
  useEffect(() => {
    if (!show('ceoName') && !data.ceoName) setValue('ceoName', 'N/A');
    if (!show('ceoPhone') && !data.ceoPhone) setValue('ceoPhone', '0000000000');
    if (!show('ceoEmail') && !data.ceoEmail) setValue('ceoEmail', 'na@example.com');
  }, [overrides, setValue, data]);

  return (
    <form id="step-form" onSubmit={handleSubmit(onNext)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">
          <User className="h-5 w-5 text-primary" />
          CEO / Managing Director *
        </h3>
        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            {show('ceoName') && (
              <div className="grid gap-1.5">
                <Label htmlFor="ceoName">Name *</Label>
                <Input id="ceoName" {...register('ceoName')} placeholder="Full name" className={errors.ceoName ? 'border-destructive' : ''} />
                {errors.ceoName && <p className="text-xs text-destructive">{errors.ceoName.message}</p>}
              </div>
            )}
            {show('ceoDesignation') && (
              <div className="grid gap-1.5">
                <Label htmlFor="ceoDesignation">Designation</Label>
                <Input id="ceoDesignation" {...register('ceoDesignation')} placeholder="e.g., CEO" />
              </div>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {show('ceoPhone') && (
              <div className="grid gap-1.5">
                <Label htmlFor="ceoPhone">Contact Number 1 *</Label>
                <Input id="ceoPhone" {...register('ceoPhone')} placeholder="+91 XXXXX XXXXX" className={errors.ceoPhone ? 'border-destructive' : ''} />
                {errors.ceoPhone && <p className="text-xs text-destructive">{errors.ceoPhone.message}</p>}
              </div>
            )}
            {show('ceoEmail') && (
              <div className="grid gap-1.5">
                <Label htmlFor="ceoEmail">Email Address 1 *</Label>
                <Input id="ceoEmail" type="email" {...register('ceoEmail')} placeholder="email@company.com" className={errors.ceoEmail ? 'border-destructive' : ''} />
                {errors.ceoEmail && <p className="text-xs text-destructive">{errors.ceoEmail.message}</p>}
              </div>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {show('ceoPhone2') && (
              <div className="grid gap-1.5">
                <Label htmlFor="ceoPhone2">Contact Number 2</Label>
                <Input id="ceoPhone2" {...register('ceoPhone2')} placeholder="+91 XXXXX XXXXX (optional)" />
              </div>
            )}
            {show('ceoEmail2') && (
              <div className="grid gap-1.5">
                <Label htmlFor="ceoEmail2">Email Address 2</Label>
                <Input id="ceoEmail2" type="email" {...register('ceoEmail2')} placeholder="alternate@company.com (optional)" className={errors.ceoEmail2 ? 'border-destructive' : ''} />
                {errors.ceoEmail2 && <p className="text-xs text-destructive">{errors.ceoEmail2.message}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title"><Briefcase className="h-5 w-5 text-primary" />Marketing / Sales Contact</h3>
        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5"><Label htmlFor="marketingName">Name</Label><Input id="marketingName" {...register('marketingName')} placeholder="Full name" /></div>
            <div className="grid gap-1.5"><Label htmlFor="marketingDesignation">Designation</Label><Input id="marketingDesignation" {...register('marketingDesignation')} placeholder="Sales Manager" /></div>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5"><Label htmlFor="marketingPhone">Contact Number</Label><Input id="marketingPhone" {...register('marketingPhone')} placeholder="+91 XXXXX XXXXX" /></div>
            <div className="grid gap-1.5"><Label htmlFor="marketingEmail">Email Address</Label><Input id="marketingEmail" type="email" {...register('marketingEmail')} placeholder="email@company.com" /></div>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title"><Users className="h-5 w-5 text-primary" />Production Contact</h3>
        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5"><Label htmlFor="productionName">Name</Label><Input id="productionName" {...register('productionName')} placeholder="Full name" /></div>
            <div className="grid gap-1.5"><Label htmlFor="productionDesignation">Designation</Label><Input id="productionDesignation" {...register('productionDesignation')} placeholder="Production Manager" /></div>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5"><Label htmlFor="productionPhone">Contact Number</Label><Input id="productionPhone" {...register('productionPhone')} placeholder="+91 XXXXX XXXXX" /></div>
            <div className="grid gap-1.5"><Label htmlFor="productionEmail">Email Address</Label><Input id="productionEmail" type="email" {...register('productionEmail')} placeholder="email@company.com" /></div>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title"><Headphones className="h-5 w-5 text-primary" />Customer Service Contact</h3>
        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5"><Label htmlFor="customerServiceName">Name</Label><Input id="customerServiceName" {...register('customerServiceName')} placeholder="Full name" /></div>
            <div className="grid gap-1.5"><Label htmlFor="customerServiceDesignation">Designation</Label><Input id="customerServiceDesignation" {...register('customerServiceDesignation')} placeholder="Customer Service Head" /></div>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5"><Label htmlFor="customerServicePhone">Contact Number</Label><Input id="customerServicePhone" {...register('customerServicePhone')} placeholder="+91 XXXXX XXXXX" /></div>
            <div className="grid gap-1.5"><Label htmlFor="customerServiceEmail">Email Address</Label><Input id="customerServiceEmail" type="email" {...register('customerServiceEmail')} placeholder="email@company.com" /></div>
          </div>
        </div>
      </div>
    </form>
  );
}
