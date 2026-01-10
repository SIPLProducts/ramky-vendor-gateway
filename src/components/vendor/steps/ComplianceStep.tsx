import { useState } from 'react';
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
import { FileUp, Shield, Award, Globe } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUpload } from '@/components/vendor/FileUpload';
import { 
  StatutoryDetails, 
  ENTITY_TYPES,
  MEMBERSHIP_OPTIONS,
  ENLISTMENT_OPTIONS,
  CERTIFICATION_OPTIONS,
  OPERATIONAL_NETWORKS 
} from '@/types/vendor';

const schema = z.object({
  firmRegistrationNo: z.string().optional(),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').or(z.literal('')),
  pfNumber: z.string().optional(),
  esiNumber: z.string().optional(),
  msmeNumber: z.string().optional(),
  msmeCategory: z.enum(['micro', 'small', 'medium', '']),
  labourPermitNo: z.string().optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST format').or(z.literal('')),
  iecNo: z.string().optional(),
  entityType: z.string().min(1, 'Entity type is required'),
  memberships: z.array(z.string()).optional(),
  enlistments: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  operationalNetwork: z.string().optional(),
});

interface ComplianceStepProps {
  data: StatutoryDetails;
  onNext: (data: StatutoryDetails) => void;
  onBack: () => void;
}

export function ComplianceStep({ data, onNext }: ComplianceStepProps) {
  const [gstCertificateFile, setGstCertificateFile] = useState<File | null>(data.gstCertificateFile);
  const [panCardFile, setPanCardFile] = useState<File | null>(data.panCardFile);
  const [msmeCertificateFile, setMsmeCertificateFile] = useState<File | null>(data.msmeCertificateFile);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<StatutoryDetails>({
    resolver: zodResolver(schema),
    defaultValues: data,
  });

  const handleFormSubmit = (formData: StatutoryDetails) => {
    onNext({
      ...formData,
      gstCertificateFile,
      panCardFile,
      msmeCertificateFile,
    });
  };

  return (
    <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Registration Details */}
      <div className="form-section">
        <h3 className="form-section-title">
          <FileUp className="h-5 w-5 text-primary" />
          Registration Details
        </h3>

        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="firmRegistrationNo">Firm Registration No.</Label>
              <Input
                id="firmRegistrationNo"
                {...register('firmRegistrationNo')}
                placeholder="Enter registration number"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="entityType">Entity Type *</Label>
              <Controller
                name="entityType"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className={errors.entityType ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select entity type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.entityType && (
                <p className="text-xs text-destructive">{errors.entityType.message}</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="pan">PAN Number</Label>
              <Input
                id="pan"
                {...register('pan')}
                placeholder="ABCDE1234F"
                className={`uppercase ${errors.pan ? 'border-destructive' : ''}`}
                maxLength={10}
              />
              {errors.pan && (
                <p className="text-xs text-destructive">{errors.pan.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input
                id="gstin"
                {...register('gstin')}
                placeholder="22AAAAA0000A1Z5"
                className={`uppercase ${errors.gstin ? 'border-destructive' : ''}`}
                maxLength={15}
              />
              {errors.gstin && (
                <p className="text-xs text-destructive">{errors.gstin.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="iecNo">IEC No. (Import/Export)</Label>
              <Input
                id="iecNo"
                {...register('iecNo')}
                placeholder="IEC Number"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="pfNumber">PF Number</Label>
              <Input
                id="pfNumber"
                {...register('pfNumber')}
                placeholder="PF registration number"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="esiNumber">ESI Number</Label>
              <Input
                id="esiNumber"
                {...register('esiNumber')}
                placeholder="ESI registration number"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="labourPermitNo">Labour Permit No.</Label>
              <Input
                id="labourPermitNo"
                {...register('labourPermitNo')}
                placeholder="Labour permit number"
              />
            </div>
          </div>
        </div>
      </div>

      {/* MSME Details */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Shield className="h-5 w-5 text-primary" />
          MSME Details
        </h3>

        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="msmeNumber">MSME/Udyam Number</Label>
              <Input
                id="msmeNumber"
                {...register('msmeNumber')}
                placeholder="UDYAM-XX-00-0000000"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>MSME Category</Label>
              <Controller
                name="msmeCategory"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select MSME category" />
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
          </div>
        </div>
      </div>

      {/* Memberships & Certifications */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Award className="h-5 w-5 text-primary" />
          Memberships & Certifications
        </h3>

        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <Label>Memberships</Label>
            <Controller
              name="memberships"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={MEMBERSHIP_OPTIONS.map((opt) => ({ label: opt, value: opt }))}
                  selected={field.value || []}
                  onChange={field.onChange}
                  placeholder="Select memberships"
                />
              )}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Enlistment With</Label>
            <Controller
              name="enlistments"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={ENLISTMENT_OPTIONS.map((opt) => ({ label: opt, value: opt }))}
                  selected={field.value || []}
                  onChange={field.onChange}
                  placeholder="Select enlistments"
                />
              )}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Certifications</Label>
            <Controller
              name="certifications"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={CERTIFICATION_OPTIONS.map((opt) => ({ label: opt, value: opt }))}
                  selected={field.value || []}
                  onChange={field.onChange}
                  placeholder="Select certifications"
                />
              )}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Operational Network</Label>
            <Controller
              name="operationalNetwork"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select operational network" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATIONAL_NETWORKS.map((network) => (
                      <SelectItem key={network} value={network}>
                        {network}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>

      {/* Document Uploads */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Globe className="h-5 w-5 text-primary" />
          Supporting Documents
        </h3>

        <Alert className="mb-5">
          <AlertDescription>
            Please attach copies of all relevant registration certificates
          </AlertDescription>
        </Alert>

        <div className="grid gap-5">
          <FileUpload
            label="GST Certificate"
            accept=".pdf,.jpg,.jpeg,.png"
            documentType="gst_certificate"
            onFileSelect={setGstCertificateFile}
            currentFile={gstCertificateFile}
          />

          <FileUpload
            label="PAN Card"
            accept=".pdf,.jpg,.jpeg,.png"
            documentType="pan_card"
            onFileSelect={setPanCardFile}
            currentFile={panCardFile}
          />

          <FileUpload
            label="MSME Certificate"
            accept=".pdf,.jpg,.jpeg,.png"
            documentType="msme_certificate"
            onFileSelect={setMsmeCertificateFile}
            currentFile={msmeCertificateFile}
          />
        </div>
      </div>
    </form>
  );
}
