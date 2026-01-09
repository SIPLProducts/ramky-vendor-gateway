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
import { StatutoryDetails } from '@/types/vendor';
import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUpload } from '@/components/vendor/FileUpload';
import { useState } from 'react';

const schema = z.object({
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format'),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),
  msmeNumber: z.string().optional(),
  msmeCategory: z.enum(['micro', 'small', 'medium', '']).optional(),
  entityType: z.string().min(1, 'Entity type is required'),
});

interface StatutoryStepProps {
  data: StatutoryDetails;
  onNext: (data: StatutoryDetails) => void;
  onBack: () => void;
}

export function StatutoryStep({ data, onNext, onBack }: StatutoryStepProps) {
  const [gstCertificateFile, setGstCertificateFile] = useState<File | null>(data.gstCertificateFile);
  const [panCardFile, setPanCardFile] = useState<File | null>(data.panCardFile);
  const [msmeCertificateFile, setMsmeCertificateFile] = useState<File | null>(data.msmeCertificateFile);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Omit<StatutoryDetails, 'gstCertificateFile' | 'panCardFile' | 'msmeCertificateFile'>>({
    resolver: zodResolver(schema),
    defaultValues: {
      gstin: data.gstin,
      pan: data.pan,
      msmeNumber: data.msmeNumber,
      msmeCategory: data.msmeCategory,
      entityType: data.entityType,
    },
  });

  const entityTypes = [
    'Proprietorship',
    'Partnership',
    'LLP',
    'Private Limited',
    'Public Limited',
    'Trust',
    'Society',
    'Government',
  ];

  const handleFormSubmit = (formData: Omit<StatutoryDetails, 'gstCertificateFile' | 'panCardFile' | 'msmeCertificateFile'>) => {
    onNext({
      ...formData,
      gstCertificateFile,
      panCardFile,
      msmeCertificateFile,
    });
  };

  return (
    <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          GST and PAN details will be validated against government databases. Please ensure accuracy.
        </AlertDescription>
      </Alert>

      <div className="form-section">
        <h3 className="form-section-title">GST Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="gstin">GSTIN *</Label>
            <Input
              id="gstin"
              {...register('gstin')}
              placeholder="e.g., 36AABCU9603R1ZM"
              className="uppercase"
              maxLength={15}
            />
            {errors.gstin && (
              <p className="text-sm text-destructive">{errors.gstin.message}</p>
            )}
            <p className="text-xs text-muted-foreground">15-character GST Identification Number</p>
          </div>

          <FileUpload
            label="GST Certificate"
            accept=".pdf,.jpg,.jpeg,.png"
            documentType="gst_certificate"
            onFileSelect={setGstCertificateFile}
            currentFile={gstCertificateFile}
            required
          />
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">PAN Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pan">PAN Number *</Label>
            <Input
              id="pan"
              {...register('pan')}
              placeholder="e.g., AABCU9603R"
              className="uppercase"
              maxLength={10}
            />
            {errors.pan && (
              <p className="text-sm text-destructive">{errors.pan.message}</p>
            )}
            <p className="text-xs text-muted-foreground">10-character Permanent Account Number</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entityType">Entity Type *</Label>
            <Controller
              name="entityType"
              control={control}
              render={({ field: { ref, ...fieldProps } }) => (
                <Select value={fieldProps.value} onValueChange={fieldProps.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    {entityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.entityType && (
              <p className="text-sm text-destructive">{errors.entityType.message}</p>
            )}
          </div>

          <FileUpload
            label="PAN Card"
            accept=".pdf,.jpg,.jpeg,.png"
            documentType="pan_card"
            onFileSelect={setPanCardFile}
            currentFile={panCardFile}
            required
          />
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">MSME / Udyam Registration (Optional)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Provide MSME details if registered under Udyam
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="msmeNumber">Udyam Registration Number</Label>
            <Input
              id="msmeNumber"
              {...register('msmeNumber')}
              placeholder="e.g., UDYAM-XX-00-0000000"
              className="uppercase"
            />
            <p className="text-xs text-muted-foreground">Format: UDYAM-XX-00-0000000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="msmeCategory">MSME Category</Label>
            <Controller
              name="msmeCategory"
              control={control}
              render={({ field: { ref, ...fieldProps } }) => (
                <Select value={fieldProps.value} onValueChange={fieldProps.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="micro">Micro Enterprise</SelectItem>
                    <SelectItem value="small">Small Enterprise</SelectItem>
                    <SelectItem value="medium">Medium Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <FileUpload
            label="MSME Certificate"
            accept=".pdf"
            documentType="msme_certificate"
            onFileSelect={setMsmeCertificateFile}
            currentFile={msmeCertificateFile}
          />
        </div>
      </div>
    </form>
  );
}
