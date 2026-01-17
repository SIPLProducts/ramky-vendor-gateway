import { useState, useEffect } from 'react';
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
import { VerifyButton } from '@/components/vendor/VerifyButton';
import { ValidationMessage } from '@/components/vendor/ValidationMessage';
import { useFieldValidation } from '@/hooks/useFieldValidation';
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
  pan: z.string().min(1).or(z.literal('')),
  pfNumber: z.string().optional(),
  esiNumber: z.string().optional(),
  msmeNumber: z.string().optional(),
  msmeCategory: z.enum(['micro', 'small', 'medium', '']),
  labourPermitNo: z.string().optional(),
  gstin: z.string().min(1).or(z.literal('')),
  iecNo: z.string().optional(),
  entityType: z.string().min(1, 'Entity type is required'),
  memberships: z.array(z.string()).optional(),
  enlistments: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  operationalNetwork: z.string().optional(),
});

interface ComplianceStepProps {
  data: StatutoryDetails;
  legalName?: string;
  onNext: (data: StatutoryDetails) => void;
  onBack: () => void;
  onValidationStateChange?: (isValid: boolean) => void;
}

export function ComplianceStep({ data, legalName, onNext, onValidationStateChange }: ComplianceStepProps) {
  const [gstCertificateFile, setGstCertificateFile] = useState<File | null>(data.gstCertificateFile);
  const [panCardFile, setPanCardFile] = useState<File | null>(data.panCardFile);
  const [msmeCertificateFile, setMsmeCertificateFile] = useState<File | null>(data.msmeCertificateFile);
  
  const { 
    validationStates, 
    validateGST, 
    validatePAN, 
    validateMSME,
    resetValidation 
  } = useFieldValidation();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<StatutoryDetails>({
    resolver: zodResolver(schema),
    defaultValues: data,
  });

  const gstinValue = watch('gstin');
  const panValue = watch('pan');
  const msmeValue = watch('msmeNumber');

  // Reset validation state when field value changes
  useEffect(() => {
    if (validationStates.gst.status !== 'idle') {
      resetValidation('gst');
    }
  }, [gstinValue]);

  useEffect(() => {
    if (validationStates.pan.status !== 'idle') {
      resetValidation('pan');
    }
  }, [panValue]);

  useEffect(() => {
    if (validationStates.msme.status !== 'idle') {
      resetValidation('msme');
    }
  }, [msmeValue]);

  // Calculate if all required validations pass
  useEffect(() => {
    const gstValid = !gstinValue || validationStates.gst.status === 'passed';
    const panValid = !panValue || validationStates.pan.status === 'passed';
    const msmeValid = !msmeValue || validationStates.msme.status === 'passed';
    
    onValidationStateChange?.(gstValid && panValid && msmeValid);
  }, [gstinValue, panValue, msmeValue, validationStates, onValidationStateChange]);

  const handleVerifyGST = async () => {
    await validateGST(gstinValue || '', legalName);
  };

  const handleVerifyPAN = async () => {
    await validatePAN(panValue || '', legalName);
  };

  const handleVerifyMSME = async () => {
    await validateMSME(msmeValue || '', legalName);
  };

  const handleFormSubmit = (formData: StatutoryDetails) => {
    // Check validations before submitting
    const gstNeedsValidation = formData.gstin && validationStates.gst.status !== 'passed';
    const panNeedsValidation = formData.pan && validationStates.pan.status !== 'passed';
    const msmeNeedsValidation = formData.msmeNumber && validationStates.msme.status !== 'passed';

    if (gstNeedsValidation || panNeedsValidation || msmeNeedsValidation) {
      return; // Don't submit, validation required
    }

    onNext({
      ...formData,
      gstCertificateFile,
      panCardFile,
      msmeCertificateFile,
    });
  };

  const canProceed = () => {
    const gstValid = !gstinValue || validationStates.gst.status === 'passed';
    const panValid = !panValue || validationStates.pan.status === 'passed';
    const msmeValid = !msmeValue || validationStates.msme.status === 'passed';
    return gstValid && panValid && msmeValid;
  };

  return (
    <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Validation Notice */}
      {!canProceed() && (
        <Alert className="border-warning bg-warning/10">
          <AlertDescription className="text-warning-foreground">
            Please verify all entered compliance details (GST, PAN, MSME) before proceeding to the next step.
          </AlertDescription>
        </Alert>
      )}

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

          {/* PAN with Verification */}
          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5 md:col-span-2">
              <Label htmlFor="pan">PAN Number</Label>
              <div className="flex gap-2">
                <Input
                  id="pan"
                  {...register('pan')}
                  placeholder="ABCDE1234F"
                  className={`uppercase flex-1 ${errors.pan ? 'border-destructive' : ''}`}
                  maxLength={10}
                />
                <VerifyButton
                  onClick={handleVerifyPAN}
                  state={validationStates.pan}
                  disabled={!panValue || panValue.length !== 10}
                />
              </div>
              {errors.pan && (
                <p className="text-xs text-destructive">{errors.pan.message}</p>
              )}
              <ValidationMessage state={validationStates.pan} />
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

          {/* GST with Verification */}
          <div className="grid gap-1.5">
            <Label htmlFor="gstin">GSTIN</Label>
            <div className="flex gap-2">
              <Input
                id="gstin"
                {...register('gstin')}
                placeholder="22AAAAA0000A1Z5"
                className={`uppercase flex-1 ${errors.gstin ? 'border-destructive' : ''}`}
                maxLength={15}
              />
              <VerifyButton
                onClick={handleVerifyGST}
                state={validationStates.gst}
                disabled={!gstinValue || gstinValue.length !== 15}
              />
            </div>
            {errors.gstin && (
              <p className="text-xs text-destructive">{errors.gstin.message}</p>
            )}
            <ValidationMessage state={validationStates.gst} />
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

      {/* MSME Details with Verification */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Shield className="h-5 w-5 text-primary" />
          MSME Details
        </h3>

        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="msmeNumber">MSME/Udyam Number</Label>
              <div className="flex gap-2">
                <Input
                  id="msmeNumber"
                  {...register('msmeNumber')}
                  placeholder="UDYAM-XX-00-0000000"
                  className="flex-1"
                />
                <VerifyButton
                  onClick={handleVerifyMSME}
                  state={validationStates.msme}
                  disabled={!msmeValue}
                />
              </div>
              <ValidationMessage state={validationStates.msme} />
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
