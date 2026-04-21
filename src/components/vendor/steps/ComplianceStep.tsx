import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { FileUp, Shield, Award, Globe, Download, FileText } from 'lucide-react';
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
  OPERATIONAL_NETWORKS,
} from '@/types/vendor';

const schema = z.object({
  firmRegistrationNo: z.string().optional(),
  pan: z.string().min(1).or(z.literal('')),
  pfNumber: z.string().optional(),
  esiNumber: z.string().optional(),
  isGstRegistered: z.boolean(),
  gstin: z.string().optional(),
  gstDeclarationReason: z.string().optional(),
  gstConstitutionOfBusiness: z.string().optional(),
  gstPrincipalPlaceOfBusiness: z.string().optional(),
  gstRegistrationDate: z.string().optional(),
  gstStatus: z.string().optional(),
  gstTaxpayerType: z.string().optional(),
  gstJurisdictionCentre: z.string().optional(),
  gstJurisdictionState: z.string().optional(),
  isMsmeRegistered: z.boolean(),
  msmeNumber: z.string().optional(),
  msmeCategory: z.enum(['micro', 'small', 'medium', '']),
  labourPermitNo: z.string().optional(),
  iecNo: z.string().optional(),
  entityType: z.string().min(1, 'Entity type is required'),
  memberships: z.array(z.string()).optional(),
  enlistments: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  gstAdditionalPlaces: z.array(z.string()).optional(),
  gstBusinessNature: z.array(z.string()).optional(),
  operationalNetwork: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.isGstRegistered && (!d.gstin || d.gstin.length !== 15)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gstin'], message: 'GSTIN is required (15 chars) when GST registered' });
  }
  if (d.isMsmeRegistered && !d.msmeNumber) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['msmeNumber'], message: 'MSME/Udyam number is required when MSME registered' });
  }
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
  const [gstSelfDeclarationFile, setGstSelfDeclarationFile] = useState<File | null>(data.gstSelfDeclarationFile);

  const { validationStates, validateGST, validatePAN, validateMSME, resetValidation } = useFieldValidation();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<StatutoryDetails>({
    resolver: zodResolver(schema) as never,
    defaultValues: data,
  });

  const isGstRegistered = watch('isGstRegistered');
  const isMsmeRegistered = watch('isMsmeRegistered');
  const gstinValue = watch('gstin');
  const panValue = watch('pan');
  const msmeValue = watch('msmeNumber');

  useEffect(() => {
    if (validationStates.gst.status !== 'idle') resetValidation('gst');
  }, [gstinValue, isGstRegistered]);

  useEffect(() => {
    if (validationStates.pan.status !== 'idle') resetValidation('pan');
  }, [panValue]);

  useEffect(() => {
    if (validationStates.msme.status !== 'idle') resetValidation('msme');
  }, [msmeValue, isMsmeRegistered]);

  useEffect(() => {
    const gstValid = !isGstRegistered || !gstinValue || validationStates.gst.status === 'passed';
    const panValid = !panValue || validationStates.pan.status === 'passed';
    const msmeValid = !isMsmeRegistered || !msmeValue || validationStates.msme.status === 'passed';
    onValidationStateChange?.(gstValid && panValid && msmeValid);
  }, [isGstRegistered, isMsmeRegistered, gstinValue, panValue, msmeValue, validationStates, onValidationStateChange]);

  const handleVerifyGST = async () => { await validateGST(gstinValue || '', legalName); };
  const handleVerifyPAN = async () => { await validatePAN(panValue || '', legalName); };
  const handleVerifyMSME = async () => { await validateMSME(msmeValue || '', legalName); };

  const handleFormSubmit = (formData: StatutoryDetails) => {
    if (formData.isGstRegistered && formData.gstin && validationStates.gst.status !== 'passed') return;
    if (formData.pan && validationStates.pan.status !== 'passed') return;
    if (formData.isMsmeRegistered && formData.msmeNumber && validationStates.msme.status !== 'passed') return;

    onNext({
      ...formData,
      gstCertificateFile,
      panCardFile,
      msmeCertificateFile,
      gstSelfDeclarationFile,
    });
  };

  const canProceed = () => {
    const gstValid = !isGstRegistered || !gstinValue || validationStates.gst.status === 'passed';
    const panValid = !panValue || validationStates.pan.status === 'passed';
    const msmeValid = !isMsmeRegistered || !msmeValue || validationStates.msme.status === 'passed';
    return gstValid && panValid && msmeValid;
  };

  return (
    <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
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
              <Input id="firmRegistrationNo" {...register('firmRegistrationNo')} placeholder="Enter registration number" />
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
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.entityType && <p className="text-xs text-destructive">{errors.entityType.message}</p>}
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
                <VerifyButton onClick={handleVerifyPAN} state={validationStates.pan} disabled={!panValue || panValue.length !== 10} />
              </div>
              {errors.pan && <p className="text-xs text-destructive">{errors.pan.message}</p>}
              <ValidationMessage state={validationStates.pan} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="iecNo">IEC No. (Import/Export)</Label>
              <Input id="iecNo" {...register('iecNo')} placeholder="IEC Number" />
            </div>
          </div>
        </div>
      </div>

      {/* GST Section with Yes/No */}
      <div className="form-section">
        <h3 className="form-section-title">
          <FileText className="h-5 w-5 text-primary" />
          GST Registration
        </h3>

        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label>Are you GST registered? *</Label>
            <Controller
              name="isGstRegistered"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value ? 'yes' : 'no'}
                  onValueChange={(v) => field.onChange(v === 'yes')}
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="yes" id="gst-yes" />
                    <Label htmlFor="gst-yes" className="font-normal cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="gst-no" />
                    <Label htmlFor="gst-no" className="font-normal cursor-pointer">No</Label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>

          {isGstRegistered ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="gstin">GSTIN *</Label>
                <div className="flex gap-2">
                  <Input
                    id="gstin"
                    {...register('gstin')}
                    placeholder="22AAAAA0000A1Z5"
                    className={`uppercase flex-1 ${errors.gstin ? 'border-destructive' : ''}`}
                    maxLength={15}
                  />
                  <VerifyButton onClick={handleVerifyGST} state={validationStates.gst} disabled={!gstinValue || gstinValue.length !== 15} />
                </div>
                {errors.gstin && <p className="text-xs text-destructive">{errors.gstin.message}</p>}
                <ValidationMessage state={validationStates.gst} />
              </div>

              <FileUpload
                label="GST Certificate"
                accept=".pdf,.jpg,.jpeg,.png"
                documentType="gst_certificate"
                onFileSelect={setGstCertificateFile}
                currentFile={gstCertificateFile}
              />

              {/* Extended GST fields (auto-populated, editable) */}
              <div className="rounded-md border border-border p-4 bg-muted/30">
                <h4 className="text-sm font-semibold mb-3 text-foreground">GST Certificate Details</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  These fields are auto-populated when you verify your GSTIN or upload the certificate. You may edit if needed.
                </p>
                <div className="grid gap-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="gstConstitutionOfBusiness">Constitution of Business</Label>
                      <Input id="gstConstitutionOfBusiness" {...register('gstConstitutionOfBusiness')} placeholder="e.g. Private Limited Company" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="gstStatus">GSTIN Status</Label>
                      <Input id="gstStatus" {...register('gstStatus')} placeholder="Active / Cancelled / Suspended" />
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="gstPrincipalPlaceOfBusiness">Principal Place of Business</Label>
                    <Textarea id="gstPrincipalPlaceOfBusiness" {...register('gstPrincipalPlaceOfBusiness')} placeholder="Full address" rows={2} />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="gstRegistrationDate">Date of Registration</Label>
                      <Input id="gstRegistrationDate" type="date" {...register('gstRegistrationDate')} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="gstTaxpayerType">Taxpayer Type</Label>
                      <Input id="gstTaxpayerType" {...register('gstTaxpayerType')} placeholder="Regular / Composition / SEZ / Casual" />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="gstJurisdictionCentre">Jurisdiction — Centre</Label>
                      <Input id="gstJurisdictionCentre" {...register('gstJurisdictionCentre')} placeholder="Centre jurisdiction" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="gstJurisdictionState">Jurisdiction — State</Label>
                      <Input id="gstJurisdictionState" {...register('gstJurisdictionState')} placeholder="State jurisdiction" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Please download the GST Self-Declaration form, sign it, and upload the signed copy below.
                </AlertDescription>
              </Alert>

              <div>
                <Button asChild type="button" variant="outline" size="sm">
                  <a href="/templates/gst-self-declaration.html" target="_blank" rel="noopener noreferrer" download>
                    <Download className="h-4 w-4 mr-2" />
                    Download GST Self-Declaration Template
                  </a>
                </Button>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="gstDeclarationReason">Reason for non-registration (optional)</Label>
                <Textarea
                  id="gstDeclarationReason"
                  {...register('gstDeclarationReason')}
                  placeholder="e.g. Turnover below GST threshold limit"
                  rows={2}
                />
              </div>

              <FileUpload
                label="Signed GST Self-Declaration *"
                accept=".pdf,.jpg,.jpeg,.png"
                documentType="gst_self_declaration"
                onFileSelect={setGstSelfDeclarationFile}
                currentFile={gstSelfDeclarationFile}
              />
            </div>
          )}
        </div>
      </div>

      {/* MSME with Yes/No */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Shield className="h-5 w-5 text-primary" />
          MSME Registration
        </h3>

        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label>Are you MSME registered? *</Label>
            <Controller
              name="isMsmeRegistered"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value ? 'yes' : 'no'}
                  onValueChange={(v) => field.onChange(v === 'yes')}
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="yes" id="msme-yes" />
                    <Label htmlFor="msme-yes" className="font-normal cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="msme-no" />
                    <Label htmlFor="msme-no" className="font-normal cursor-pointer">No</Label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>

          {isMsmeRegistered && (
            <>
              <div className="grid md:grid-cols-2 gap-5">
                <div className="grid gap-1.5">
                  <Label htmlFor="msmeNumber">MSME/Udyam Number *</Label>
                  <div className="flex gap-2">
                    <Input id="msmeNumber" {...register('msmeNumber')} placeholder="UDYAM-XX-00-0000000" className="flex-1" />
                    <VerifyButton onClick={handleVerifyMSME} state={validationStates.msme} disabled={!msmeValue} />
                  </div>
                  {errors.msmeNumber && <p className="text-xs text-destructive">{errors.msmeNumber.message}</p>}
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

              <FileUpload
                label="MSME Certificate"
                accept=".pdf,.jpg,.jpeg,.png"
                documentType="msme_certificate"
                onFileSelect={setMsmeCertificateFile}
                currentFile={msmeCertificateFile}
              />
            </>
          )}
        </div>
      </div>

      {/* Other Compliance */}
      <div className="form-section">
        <h3 className="form-section-title">
          <FileUp className="h-5 w-5 text-primary" />
          Labour & Other Registrations
        </h3>
        <div className="grid md:grid-cols-3 gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="pfNumber">PF Number</Label>
            <Input id="pfNumber" {...register('pfNumber')} placeholder="PF registration number" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="esiNumber">ESI Number</Label>
            <Input id="esiNumber" {...register('esiNumber')} placeholder="ESI registration number" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="labourPermitNo">Labour Permit No.</Label>
            <Input id="labourPermitNo" {...register('labourPermitNo')} placeholder="Labour permit number" />
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
                <MultiSelect options={MEMBERSHIP_OPTIONS.map((opt) => ({ label: opt, value: opt }))} selected={field.value || []} onChange={field.onChange} placeholder="Select memberships" />
              )}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Enlistment With</Label>
            <Controller
              name="enlistments"
              control={control}
              render={({ field }) => (
                <MultiSelect options={ENLISTMENT_OPTIONS.map((opt) => ({ label: opt, value: opt }))} selected={field.value || []} onChange={field.onChange} placeholder="Select enlistments" />
              )}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Certifications</Label>
            <Controller
              name="certifications"
              control={control}
              render={({ field }) => (
                <MultiSelect options={CERTIFICATION_OPTIONS.map((opt) => ({ label: opt, value: opt }))} selected={field.value || []} onChange={field.onChange} placeholder="Select certifications" />
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
                      <SelectItem key={network} value={network}>{network}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>

      {/* PAN Document Upload */}
      <div className="form-section">
        <h3 className="form-section-title">
          <Globe className="h-5 w-5 text-primary" />
          Identity Documents
        </h3>
        <FileUpload
          label="PAN Card"
          accept=".pdf,.jpg,.jpeg,.png"
          documentType="pan_card"
          onFileSelect={setPanCardFile}
          currentFile={panCardFile}
        />
      </div>
    </form>
  );
}
