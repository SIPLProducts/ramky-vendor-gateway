import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { FileUp, Award } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KycTabs, KycStatus } from '@/components/vendor/kyc/KycTabs';
import { GstKycTab } from '@/components/vendor/kyc/GstKycTab';
import { PanKycTab } from '@/components/vendor/kyc/PanKycTab';
import { MsmeKycTab } from '@/components/vendor/kyc/MsmeKycTab';
import { BankKycTab } from '@/components/vendor/kyc/BankKycTab';
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
  pan: z.string().optional(),
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
  msmeEnterpriseName: z.string().optional(),
  msmeEnterpriseType: z.string().optional(),
  msmeMajorActivity: z.string().optional(),
  msmeOrganizationType: z.string().optional(),
  msmeRegistrationDate: z.string().optional(),
  msmeState: z.string().optional(),
  msmeDistrict: z.string().optional(),
  labourPermitNo: z.string().optional(),
  iecNo: z.string().optional(),
  entityType: z.string().min(1, 'Entity type is required'),
  memberships: z.array(z.string()).optional(),
  enlistments: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  gstAdditionalPlaces: z.array(z.string()).optional(),
  gstBusinessNature: z.array(z.string()).optional(),
  operationalNetwork: z.string().optional(),
});

interface ComplianceStepProps {
  data: StatutoryDetails;
  legalName?: string;
  onNext: (data: StatutoryDetails & {
    bankAccountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    branchName?: string;
    cancelledChequeFile?: File | null;
  }) => void;
  onBack: () => void;
  onValidationStateChange?: (isValid: boolean) => void;
  vendorId?: string;
  /** Optional callback so parent can mirror verified bank info into BankDetails */
  onBankVerified?: (bank: {
    bankAccountNumber: string;
    ifscCode: string;
    bankName?: string;
    branchName?: string;
    accountHolderName?: string;
    cancelledChequeFile: File | null;
  }) => void;
}

export function ComplianceStep({
  data,
  legalName,
  onNext,
  onValidationStateChange,
  vendorId,
  onBankVerified,
}: ComplianceStepProps) {
  // Files
  const [gstCertificateFile, setGstCertificateFile] = useState<File | null>(data.gstCertificateFile);
  const [panCardFile, setPanCardFile] = useState<File | null>(data.panCardFile);
  const [msmeCertificateFile, setMsmeCertificateFile] = useState<File | null>(data.msmeCertificateFile);
  const [gstSelfDeclarationFile, setGstSelfDeclarationFile] = useState<File | null>(data.gstSelfDeclarationFile);
  const [cancelledChequeFile, setCancelledChequeFile] = useState<File | null>(null);

  // Bank state (Bank tab populates this)
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState<string | undefined>();
  const [branchName, setBranchName] = useState<string | undefined>();
  const [accountHolderName, setAccountHolderName] = useState<string | undefined>();

  // KYC tab statuses
  const [statuses, setStatuses] = useState<Record<'gst' | 'pan' | 'msme' | 'bank', KycStatus>>({
    gst: 'idle', pan: 'idle', msme: 'idle', bank: 'idle',
  });
  const setStatus = (k: keyof typeof statuses, s: KycStatus) =>
    setStatuses((prev) => (prev[k] === s ? prev : { ...prev, [k]: s }));

  const [activeTab, setActiveTab] = useState<'gst' | 'pan' | 'msme' | 'bank'>('gst');

  const {
    register, handleSubmit, control, watch, setValue,
    formState: { errors },
  } = useForm<StatutoryDetails>({
    resolver: zodResolver(schema) as never,
    defaultValues: data,
  });

  const isGstRegistered = watch('isGstRegistered');
  const isMsmeRegistered = watch('isMsmeRegistered');
  const gstin = watch('gstin') || '';
  const pan = watch('pan') || '';
  const msmeNumber = watch('msmeNumber') || '';

  const isStepValid =
    (statuses.gst === 'passed' || statuses.gst === 'na' || (!isGstRegistered && !!gstSelfDeclarationFile)) &&
    statuses.pan === 'passed' &&
    (statuses.msme === 'passed' || statuses.msme === 'na' || !isMsmeRegistered) &&
    statuses.bank === 'passed';

  useEffect(() => {
    onValidationStateChange?.(isStepValid);
  }, [isStepValid, onValidationStateChange]);

  const handleGstVerified = (d: Record<string, any>) => {
    if (d.constitution_of_business) setValue('gstConstitutionOfBusiness', d.constitution_of_business);
    if (d.principal_place_of_business)
      setValue('gstPrincipalPlaceOfBusiness', d.principal_place_of_business);
    else if (d.address) setValue('gstPrincipalPlaceOfBusiness', d.address);
    if (d.registration_date) setValue('gstRegistrationDate', d.registration_date);
    if (d.status || d.gst_status) setValue('gstStatus', d.status || d.gst_status);
    if (d.taxpayer_type) setValue('gstTaxpayerType', d.taxpayer_type);
    if (d.jurisdiction_centre) setValue('gstJurisdictionCentre', d.jurisdiction_centre);
    if (d.jurisdiction_state || d.state_jurisdiction)
      setValue('gstJurisdictionState', d.jurisdiction_state || d.state_jurisdiction);
  };

  const handleBankDetailsChange = (b: {
    bankAccountNumber: string; ifscCode: string;
    bankName?: string; branchName?: string; accountHolderName?: string;
  }) => {
    setBankAccountNumber(b.bankAccountNumber);
    setIfscCode(b.ifscCode);
    if (b.bankName) setBankName(b.bankName);
    if (b.branchName) setBranchName(b.branchName);
    if (b.accountHolderName) setAccountHolderName(b.accountHolderName);
  };

  const handleFormSubmit = (formData: StatutoryDetails) => {
    if (!isStepValid) return;
    if (statuses.bank === 'passed') {
      onBankVerified?.({
        bankAccountNumber, ifscCode, bankName, branchName, accountHolderName,
        cancelledChequeFile,
      });
    }
    onNext({
      ...formData,
      gstCertificateFile,
      panCardFile,
      msmeCertificateFile,
      gstSelfDeclarationFile,
      bankAccountNumber,
      ifscCode,
      bankName,
      branchName,
      cancelledChequeFile,
    });
  };

  return (
    <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {!isStepValid && (
        <Alert className="border-warning bg-warning/10">
          <AlertDescription className="text-warning-foreground">
            Please complete all four KYC verifications (GST, PAN, MSME, Bank) before proceeding.
          </AlertDescription>
        </Alert>
      )}

      {/* Registration meta (non-KYC) */}
      <div className="form-section">
        <h3 className="form-section-title">
          <FileUp className="h-5 w-5 text-primary" />
          Registration Details
        </h3>
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
          <div className="grid gap-1.5">
            <Label htmlFor="iecNo">IEC No. (Import/Export)</Label>
            <Input id="iecNo" {...register('iecNo')} placeholder="IEC Number" />
          </div>
        </div>
      </div>

      {/* 4-tab KYC */}
      <KycTabs
        active={activeTab}
        onActiveChange={setActiveTab}
        statuses={statuses}
        gst={
          <GstKycTab
            isGstRegistered={isGstRegistered}
            onIsGstRegisteredChange={(v) => setValue('isGstRegistered', v)}
            gstin={gstin}
            onGstinChange={(v) => setValue('gstin', v)}
            legalName={legalName}
            gstCertificateFile={gstCertificateFile}
            onGstCertificateFileChange={setGstCertificateFile}
            gstSelfDeclarationFile={gstSelfDeclarationFile}
            onGstSelfDeclarationFileChange={setGstSelfDeclarationFile}
            gstDeclarationReason={watch('gstDeclarationReason') || ''}
            onGstDeclarationReasonChange={(v) => setValue('gstDeclarationReason', v)}
            onVerifiedDetails={handleGstVerified}
            onStatusChange={(s) => setStatus('gst', s)}
            vendorId={vendorId}
          />
        }
        pan={
          <PanKycTab
            pan={pan}
            onPanChange={(v) => setValue('pan', v)}
            legalName={legalName}
            panCardFile={panCardFile}
            onPanCardFileChange={setPanCardFile}
            onStatusChange={(s) => setStatus('pan', s)}
            vendorId={vendorId}
          />
        }
        msme={
          <MsmeKycTab
            isMsmeRegistered={isMsmeRegistered}
            onIsMsmeRegisteredChange={(v) => setValue('isMsmeRegistered', v)}
            msmeNumber={msmeNumber}
            onMsmeNumberChange={(v) => setValue('msmeNumber', v)}
            onMsmeCategoryChange={(c) => setValue('msmeCategory', c)}
            legalName={legalName}
            msmeCertificateFile={msmeCertificateFile}
            onMsmeCertificateFileChange={setMsmeCertificateFile}
            onStatusChange={(s) => setStatus('msme', s)}
            vendorId={vendorId}
          />
        }
        bank={
          <BankKycTab
            bankAccountNumber={bankAccountNumber}
            ifscCode={ifscCode}
            onBankDetailsChange={handleBankDetailsChange}
            legalName={legalName}
            cancelledChequeFile={cancelledChequeFile}
            onCancelledChequeFileChange={setCancelledChequeFile}
            onStatusChange={(s) => setStatus('bank', s)}
            vendorId={vendorId}
          />
        }
      />

      {isGstRegistered && statuses.gst === 'passed' && (
        <div className="rounded-md border border-border p-4 bg-muted/30">
          <h4 className="text-sm font-semibold mb-3 text-foreground">GST Certificate Details</h4>
          <p className="text-xs text-muted-foreground mb-4">
            These fields were auto-populated from the verification result. You may edit if needed.
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
      )}

      {isMsmeRegistered && statuses.msme === 'passed' && (
        <div className="rounded-md border border-border p-4 bg-muted/30">
          <Label>MSME Category</Label>
          <Controller
            name="msmeCategory"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="mt-1.5">
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
      )}

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

      <div className="form-section">
        <h3 className="form-section-title">
          <Award className="h-5 w-5 text-primary" />
          Memberships & Certifications
        </h3>
        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <Label>Memberships</Label>
            <Controller name="memberships" control={control} render={({ field }) => (
              <MultiSelect options={MEMBERSHIP_OPTIONS.map((opt) => ({ label: opt, value: opt }))} selected={field.value || []} onChange={field.onChange} placeholder="Select memberships" />
            )} />
          </div>
          <div className="grid gap-1.5">
            <Label>Enlistment With</Label>
            <Controller name="enlistments" control={control} render={({ field }) => (
              <MultiSelect options={ENLISTMENT_OPTIONS.map((opt) => ({ label: opt, value: opt }))} selected={field.value || []} onChange={field.onChange} placeholder="Select enlistments" />
            )} />
          </div>
          <div className="grid gap-1.5">
            <Label>Certifications</Label>
            <Controller name="certifications" control={control} render={({ field }) => (
              <MultiSelect options={CERTIFICATION_OPTIONS.map((opt) => ({ label: opt, value: opt }))} selected={field.value || []} onChange={field.onChange} placeholder="Select certifications" />
            )} />
          </div>
          <div className="grid gap-1.5">
            <Label>Operational Network</Label>
            <Controller name="operationalNetwork" control={control} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Select operational network" /></SelectTrigger>
                <SelectContent>
                  {OPERATIONAL_NETWORKS.map((network) => (
                    <SelectItem key={network} value={network}>{network}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
          </div>
        </div>
      </div>
    </form>
  );
}
