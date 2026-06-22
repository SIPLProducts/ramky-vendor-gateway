import { useState } from 'react';
import { Building2, MapPin, Users, FileCheck, Landmark, TrendingUp, CheckCircle2, Edit2, Globe2, Award, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { VendorFormData } from '@/types/vendor';

type DocTab = 'gst' | 'pan' | 'msme' | 'bank';

interface ReviewStepProps {
  data: VendorFormData;
  onSubmit: () => void;
  onBack: () => void;
  onEditStep: (step: number, tab?: DocTab) => void;
  onDeclarationChange?: (d: { selfDeclared: boolean; termsAccepted: boolean }) => void;
}

const SectionHeader = ({
  icon: Icon,
  title,
  step,
  tab,
  onEdit,
}: {
  icon: React.ElementType;
  title: string;
  step: number;
  tab?: DocTab;
  onEdit: (step: number, tab?: DocTab) => void;
}) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" /><h3 className="text-base font-semibold text-foreground">{title}</h3></div>
    <Button variant="ghost" size="sm" onClick={() => onEdit(step, tab)} className="text-primary"><Edit2 className="h-4 w-4 mr-1" />Edit</Button>
  </div>
);

const DataRow = ({ label, value }: { label: string; value: string | undefined }) => (
  <div className="grid grid-cols-2 gap-2 py-2 border-b border-border last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{value || '-'}</span>
  </div>
);

export function ReviewStep({ data, onSubmit, onEditStep, onDeclarationChange }: ReviewStepProps) {
  const [selfDeclared, setSelfDeclared] = useState(data.declaration?.selfDeclared || false);
  const [termsAccepted, setTermsAccepted] = useState(data.declaration?.termsAccepted || false);
  const canSubmit = selfDeclared && termsAccepted;

  const updateSelfDeclared = (v: boolean) => {
    setSelfDeclared(v);
    onDeclarationChange?.({ selfDeclared: v, termsAccepted });
  };
  const updateTermsAccepted = (v: boolean) => {
    setTermsAccepted(v);
    onDeclarationChange?.({ selfDeclared, termsAccepted: v });
  };

  // Step numbers (6-step flow):
  //  1 Doc Verification (PAN/GST/MSME/Bank captured & verified here)
  //  2 Organization (incl. Statutory & Memberships)
  //  3 Address  4 Contact  5 Financial/Infra  6 Review
  const isInternational = data.vendorType === 'international';
  const intl = data.international;
  return (
    <div className="space-y-6">
      {isInternational ? (
        <>
          <div className="form-section">
            <div className="flex items-center gap-2 mb-4">
              <Globe2 className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-semibold text-foreground">International Vendor</h3>
            </div>
          </div>

          <div className="form-section">
            <SectionHeader icon={FileText} title="Documents Upload" step={1} onEdit={onEditStep} />
            <div className="space-y-1">
              <DataRow label="Registration Copy" value={intl?.documents?.registrationCopyFile ? 'Uploaded ✓' : 'Pending upload'} />
              <DataRow label="SWIFT / IBAN Details" value={intl?.documents?.swiftIbanFile ? 'Uploaded ✓' : 'Pending upload'} />
            </div>
          </div>

          <div className="form-section">
            <SectionHeader icon={Building2} title="Company Details" step={2} onEdit={onEditStep} />
            <div className="space-y-1">
              <DataRow label="Company Name" value={intl?.company?.companyName} />
              <DataRow label="Address" value={intl?.company?.companyAddress} />
              <DataRow label="Pincode" value={intl?.company?.pincode} />
              <DataRow label="Country" value={intl?.company?.country} />
              <DataRow label="Region" value={intl?.company?.region} />
              <DataRow label="Contact 1" value={intl?.company?.contact1} />
              <DataRow label="Contact 2" value={intl?.company?.contact2} />
              <DataRow label="Email 1" value={intl?.company?.email1} />
              <DataRow label="Email 2" value={intl?.company?.email2} />
            </div>
          </div>

          <div className="form-section">
            <SectionHeader icon={Landmark} title="Company Bank Details" step={3} onEdit={onEditStep} />
            <div className="space-y-1">
              <DataRow label="Account Number" value={intl?.bank?.accountNumber} />
              <DataRow label="SWIFT Code" value={intl?.bank?.swiftCode} />
              <DataRow label="Company Name" value={intl?.bank?.companyName} />
              <DataRow label="Bank Name" value={intl?.bank?.bankName} />
              <DataRow label="Bank Branch" value={intl?.bank?.bankBranch} />
              <DataRow label="IBAN Number" value={intl?.bank?.ibanNumber} />
            </div>
          </div>

          <div className="form-section">
            <SectionHeader icon={Award} title="Classification" step={4} onEdit={onEditStep} />
            <div className="space-y-1">
              <DataRow label="Material Group for Vendors" value={intl?.classification?.materialGroupVendor?.join(', ')} />
              <DataRow label="Vendor Category" value={intl?.classification?.vendorCategory?.join(', ')} />
              <DataRow label="Vendor Location" value={intl?.classification?.vendorLocation?.join(', ')} />
              <DataRow label="Identification Source" value={intl?.classification?.identificationSource?.join(', ')} />
            </div>
          </div>
        </>
      ) : (
      <>
      <div className="form-section">
        <SectionHeader icon={Building2} title="Organization Details" step={2} onEdit={onEditStep} />
        <div className="space-y-1">
          <DataRow label="Legal Name" value={data.organization?.legalName} />
          <DataRow label="Trade Name" value={data.organization?.tradeName} />
          <DataRow label="Industry Type" value={data.organization?.industryType} />
          <DataRow label="Organization Type" value={data.organization?.organizationType} />
          <DataRow label="Ownership Type" value={data.organization?.ownershipType} />
          <DataRow label="State" value={data.organization?.state} />
        </div>
      </div>

      <div className="form-section">
        <SectionHeader icon={MapPin} title="Address Information" step={3} onEdit={onEditStep} />
        <div className="space-y-5">
          <div className="rounded-lg border border-border/60 p-4 bg-muted/20">
            <h4 className="text-sm font-semibold text-foreground mb-2">Registered / Corporate Office Address</h4>
            <div className="space-y-1">
              <DataRow label="Address Line 1" value={data.address?.registeredAddress} />
              <DataRow label="Address Line 2" value={data.address?.registeredAddressLine2} />
              <DataRow label="Address Line 3" value={data.address?.registeredAddressLine3} />
              <DataRow label="Address Line 4" value={data.address?.registeredAddressLine4} />
              <DataRow label="City" value={data.address?.registeredCity} />
              <DataRow label="State" value={data.address?.registeredState} />
              <DataRow label="PIN Code" value={data.address?.registeredPincode} />
              <DataRow label="Contact 1" value={data.address?.registeredContact1 || data.contact?.ceoPhone} />
              <DataRow label="Contact 2" value={data.address?.registeredContact2} />
              <DataRow label="Email 1" value={data.address?.registeredEmail || data.contact?.ceoEmail} />
              <DataRow label="Email 2" value={data.address?.registeredEmail2} />

            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-4 bg-muted/20">
            <h4 className="text-sm font-semibold text-foreground mb-2">Communication Address</h4>
            {data.address?.sameAsRegistered ? (
              <p className="text-sm text-muted-foreground italic">Same as Registered Address</p>
            ) : (
              <div className="space-y-1">
                <DataRow label="Address Line 1" value={data.address?.manufacturingAddress} />
                <DataRow label="Address Line 2" value={data.address?.manufacturingAddressLine2} />
                <DataRow label="Address Line 3" value={data.address?.manufacturingAddressLine3} />
                <DataRow label="Address Line 4" value={data.address?.manufacturingAddressLine4} />
                <DataRow label="City" value={data.address?.manufacturingCity} />
                <DataRow label="State" value={data.address?.manufacturingState} />
                <DataRow label="PIN Code" value={data.address?.manufacturingPincode} />
                <DataRow label="Phone" value={data.address?.manufacturingPhone} />
                <DataRow label="Email" value={data.address?.manufacturingEmail} />
              </div>
            )}
          </div>
        </div>
      </div>


      <div className="form-section">
        <SectionHeader icon={Users} title="Contact Information" step={4} onEdit={onEditStep} />
        <div className="space-y-1">
          <DataRow label="CEO/MD Name" value={data.contact?.ceoName} />
          <DataRow label="CEO/MD Email 1" value={data.contact?.ceoEmail} />
          <DataRow label="CEO/MD Phone 1" value={data.contact?.ceoPhone} />
          {data.contact?.ceoEmail2 && <DataRow label="CEO/MD Email 2" value={data.contact.ceoEmail2} />}
          {data.contact?.ceoPhone2 && <DataRow label="CEO/MD Phone 2" value={data.contact.ceoPhone2} />}
        </div>
      </div>

      <div className="form-section">
        <SectionHeader icon={FileCheck} title="PAN" step={1} tab="pan" onEdit={onEditStep} />
        <div className="space-y-1">
          <DataRow label="PAN" value={data.statutory?.pan} />
        </div>
      </div>

      <div className="form-section">
        <SectionHeader icon={FileCheck} title="GST Details" step={1} tab="gst" onEdit={onEditStep} />
        <div className="space-y-1">
          <DataRow label="GST Registered" value={data.statutory?.isGstRegistered ? 'Yes' : 'No'} />
          {data.statutory?.isGstRegistered ? (
            <>
              <DataRow label="GSTIN" value={data.statutory?.gstin} />
              <DataRow label="Constitution of Business" value={data.statutory?.gstConstitutionOfBusiness} />
              <DataRow label="Principal Place of Business" value={data.statutory?.gstPrincipalPlaceOfBusiness} />
              <DataRow label="GSTIN Status" value={data.statutory?.gstStatus} />
              <DataRow label="Taxpayer Type" value={data.statutory?.gstTaxpayerType} />
              <DataRow label="Registration Date" value={data.statutory?.gstRegistrationDate} />
              <DataRow label="Jurisdiction (Centre)" value={data.statutory?.gstJurisdictionCentre} />
              <DataRow label="Jurisdiction (State)" value={data.statutory?.gstJurisdictionState} />
            </>
          ) : (
            <>
              <DataRow label="Self-Declaration" value={data.statutory?.gstSelfDeclarationFile ? 'Uploaded ✓' : 'Pending upload'} />
              <DataRow label="Reason" value={data.statutory?.gstDeclarationReason} />
            </>
          )}
        </div>
      </div>

      <div className="form-section">
        <SectionHeader icon={FileCheck} title="MSME Details" step={1} tab="msme" onEdit={onEditStep} />
        <div className="space-y-1">
          <DataRow label="MSME Registered" value={data.statutory?.isMsmeRegistered ? 'Yes' : 'No'} />
          {data.statutory?.isMsmeRegistered ? (
            <>
              <DataRow label="MSME Category" value={data.statutory?.msmeCategory} />
              <DataRow label="MSME Number" value={data.statutory?.msmeNumber} />
              <DataRow label="Udyam Certificate" value={data.statutory?.msmeCertificateFile ? 'Uploaded ✓' : 'Pending upload'} />
            </>

          ) : (
            <>
              <DataRow label="MSME Self-Declaration" value={data.statutory?.msmeSelfDeclarationFile ? 'Uploaded ✓' : 'Pending upload'} />
              <DataRow label="Reason" value={data.statutory?.msmeDeclarationReason} />
            </>
          )}
        </div>
      </div>

      <div className="form-section">
        <SectionHeader icon={Landmark} title="Bank Details" step={1} tab="bank" onEdit={onEditStep} />
        <div className="space-y-1">
          <DataRow label="Bank Name" value={data.bank?.bankName} />
          <DataRow label="Account Number" value={data.bank?.accountNumber ? data.bank.accountNumber.replace(/./g, '•').slice(0, -4) + data.bank.accountNumber.slice(-4) : '-'} />
          <DataRow label="IFSC Code" value={data.bank?.ifscCode} />
          <DataRow label="Branch" value={data.bank?.branchName} />
          <DataRow label="Account Type" value={data.bank?.accountType} />
          <DataRow label="Bank Address" value={data.bank?.bankAddress} />
        </div>
      </div>

      <div className="form-section">
        <SectionHeader icon={TrendingUp} title="Financial Information" step={5} onEdit={onEditStep} />
        <div className="space-y-1">
          <DataRow label="Expected Credit Period" value={data.financial?.creditPeriodExpected ? `${data.financial.creditPeriodExpected} days` : '-'} />
          <DataRow label="Major Customer 1" value={data.financial?.majorCustomer1} />
        </div>
      </div>
      </>
      )}



      <div className="form-section">
        <h3 className="form-section-title"><CheckCircle2 className="h-5 w-5 text-primary" />Declaration & Submission</h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <Checkbox id="selfDeclared" checked={selfDeclared} onCheckedChange={(checked) => updateSelfDeclared(checked === true)} />
            <Label htmlFor="selfDeclared" className="text-sm font-normal cursor-pointer">I declare that the information furnished above is correct to the best of my knowledge. I undertake that I will inform you of any changes in the above at the earliest.</Label>
          </div>
          <div className="flex items-start space-x-3">
            <Checkbox id="termsAccepted" checked={termsAccepted} onCheckedChange={(checked) => updateTermsAccepted(checked === true)} />
            <Label htmlFor="termsAccepted" className="text-sm font-normal cursor-pointer">I accept the Terms and Conditions and Privacy Policy of Ramky Infrastructure Limited.</Label>
          </div>
        </div>
      </div>
    </div>
  );
}
