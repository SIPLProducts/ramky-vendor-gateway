import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ContactDetails } from '@/types/vendor';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const schema = z.object({
  primaryContactName: z.string().min(2, 'Name must be at least 2 characters'),
  primaryDesignation: z.string().min(2, 'Designation is required'),
  primaryEmail: z.string().email('Invalid email address'),
  primaryPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid 10-digit mobile number'),
  secondaryContactName: z.string().optional(),
  secondaryDesignation: z.string().optional(),
  secondaryEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  secondaryPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number').optional().or(z.literal('')),
});

interface ContactStepProps {
  data: ContactDetails;
  onNext: (data: ContactDetails) => void;
  onBack: () => void;
}

export function ContactStep({ data, onNext, onBack }: ContactStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactDetails>({
    resolver: zodResolver(schema),
    defaultValues: data,
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">Primary Contact Person</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primaryContactName">Full Name *</Label>
            <Input
              id="primaryContactName"
              {...register('primaryContactName')}
              placeholder="Enter full name"
            />
            {errors.primaryContactName && (
              <p className="text-sm text-destructive">{errors.primaryContactName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryDesignation">Designation *</Label>
            <Input
              id="primaryDesignation"
              {...register('primaryDesignation')}
              placeholder="e.g., Managing Director"
            />
            {errors.primaryDesignation && (
              <p className="text-sm text-destructive">{errors.primaryDesignation.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryEmail">Email Address *</Label>
            <Input
              id="primaryEmail"
              type="email"
              {...register('primaryEmail')}
              placeholder="email@company.com"
            />
            {errors.primaryEmail && (
              <p className="text-sm text-destructive">{errors.primaryEmail.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryPhone">Mobile Number *</Label>
            <Input
              id="primaryPhone"
              {...register('primaryPhone')}
              placeholder="10-digit mobile number"
              maxLength={10}
            />
            {errors.primaryPhone && (
              <p className="text-sm text-destructive">{errors.primaryPhone.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Secondary Contact Person (Optional)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Provide an alternate contact for communication
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="secondaryContactName">Full Name</Label>
            <Input
              id="secondaryContactName"
              {...register('secondaryContactName')}
              placeholder="Enter full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondaryDesignation">Designation</Label>
            <Input
              id="secondaryDesignation"
              {...register('secondaryDesignation')}
              placeholder="e.g., Finance Manager"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondaryEmail">Email Address</Label>
            <Input
              id="secondaryEmail"
              type="email"
              {...register('secondaryEmail')}
              placeholder="email@company.com"
            />
            {errors.secondaryEmail && (
              <p className="text-sm text-destructive">{errors.secondaryEmail.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondaryPhone">Mobile Number</Label>
            <Input
              id="secondaryPhone"
              {...register('secondaryPhone')}
              placeholder="10-digit mobile number"
              maxLength={10}
            />
            {errors.secondaryPhone && (
              <p className="text-sm text-destructive">{errors.secondaryPhone.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button type="submit" className="gap-2">
          Next Step
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
