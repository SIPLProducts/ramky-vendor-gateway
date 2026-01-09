import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FinancialDetails } from '@/types/vendor';
import { Upload, IndianRupee } from 'lucide-react';

const schema = z.object({
  turnoverYear1: z.string().min(1, 'Current year turnover is required'),
  turnoverYear2: z.string().optional(),
  turnoverYear3: z.string().optional(),
  creditPeriodExpected: z.string().min(1, 'Credit period is required'),
});

interface FinancialStepProps {
  data: FinancialDetails;
  onNext: (data: FinancialDetails) => void;
  onBack: () => void;
}

export function FinancialStep({ data, onNext, onBack }: FinancialStepProps) {
  const currentYear = new Date().getFullYear();
  
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Omit<FinancialDetails, 'financialDocsFile'>>({
    resolver: zodResolver(schema),
    defaultValues: {
      turnoverYear1: data.turnoverYear1,
      turnoverYear2: data.turnoverYear2,
      turnoverYear3: data.turnoverYear3,
      creditPeriodExpected: data.creditPeriodExpected,
    },
  });

  const creditPeriods = [
    { value: '0', label: 'Immediate / Advance' },
    { value: '15', label: '15 Days' },
    { value: '30', label: '30 Days' },
    { value: '45', label: '45 Days' },
    { value: '60', label: '60 Days' },
    { value: '90', label: '90 Days' },
  ];

  const formatCurrency = (value: string) => {
    const num = parseInt(value.replace(/,/g, ''), 10);
    if (isNaN(num)) return '';
    return num.toLocaleString('en-IN');
  };

  const handleFormSubmit = (formData: Omit<FinancialDetails, 'financialDocsFile'>) => {
    onNext({
      ...formData,
      financialDocsFile: data.financialDocsFile,
    });
  };

  return (
    <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">Annual Turnover (Last 3 Years)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your company's annual turnover for the last 3 financial years
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="turnoverYear1">FY {currentYear - 1}-{currentYear.toString().slice(-2)} *</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="turnoverYear1"
                {...register('turnoverYear1')}
                placeholder="e.g., 5,00,00,000"
                className="pl-9"
              />
            </div>
            {errors.turnoverYear1 && (
              <p className="text-sm text-destructive">{errors.turnoverYear1.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="turnoverYear2">FY {currentYear - 2}-{(currentYear - 1).toString().slice(-2)}</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="turnoverYear2"
                {...register('turnoverYear2')}
                placeholder="e.g., 4,50,00,000"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="turnoverYear3">FY {currentYear - 3}-{(currentYear - 2).toString().slice(-2)}</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="turnoverYear3"
                {...register('turnoverYear3')}
                placeholder="e.g., 4,00,00,000"
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Credit Terms</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="creditPeriodExpected">Expected Credit Period *</Label>
            <Controller
              name="creditPeriodExpected"
              control={control}
              render={({ field: { ref, ...fieldProps } }) => (
                <Select value={fieldProps.value} onValueChange={fieldProps.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select credit period" />
                  </SelectTrigger>
                  <SelectContent>
                    {creditPeriods.map((period) => (
                      <SelectItem key={period.value} value={period.value}>
                        {period.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.creditPeriodExpected && (
              <p className="text-sm text-destructive">{errors.creditPeriodExpected.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Final credit terms are subject to Ramky's approval
            </p>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Financial Documents</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload CA-certified financial statements (Balance Sheet, P&L)
        </p>
        
        <div className="border-2 border-dashed rounded-md p-6 text-center hover:bg-muted/50 cursor-pointer transition-colors">
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Click to upload Financial Documents</p>
          <p className="text-xs text-muted-foreground mt-1">PDF only, Max 10MB</p>
          <p className="text-xs text-muted-foreground mt-1">
            Combine all documents into a single PDF
          </p>
        </div>
      </div>
    </form>
  );
}
