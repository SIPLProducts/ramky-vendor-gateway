import { useState } from 'react';
import { Building2, MapPin, Users, FileCheck, Landmark, TrendingUp, CheckCircle2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { VendorFormData } from '@/types/vendor';

interface ReviewStepProps {
  data: VendorFormData;
  onSubmit: () => void;
  onBack: () => void;
  onEditStep: (step: number) => void;
}

const SectionHeader = ({ icon: Icon, title, step, onEdit }: { icon: React.ElementType; title: string; step: number; onEdit: (step: number) => void }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" /><h3 className="text-base font-semibold text-foreground">{title}</h3></div>
    <Button variant="ghost" size="sm" onClick={() => onEdit(step)} className="text-primary"><Edit2 className="h-4 w-4 mr-1" />Edit</Button>
  </div>
);

const DataRow = ({ label, value }: { label: string; value: string | undefined }) => (
  <div className="grid grid-cols-2 gap-2 py-2 border-b border-border last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{value || '-'}</span>
  </div>
);

export function ReviewStep({ data, onSubmit, onEditStep }: ReviewStepProps) {
  const [selfDeclared, setSelfDeclared] = useState(data.declaration?.selfDeclared || false);
  const [termsAccepted, setTermsAccepted] = useState(data.declaration?.termsAccepted || false);
  const canSubmit = selfDeclared && termsAccepted;

  return (
    <div className="space-y-6">
      <div className="form-section">
        <SectionHeader icon={Building2} title="Organization Details" step={1} onEdit={onEditStep} />
        <div className="space-y-1">
          <DataRow label="Legal Name" value={data.organization?.legalName} />
          <DataRow label="Trade Name" value={data.organization?.tradeName} />
          <DataRow label="Industry Type" value={data.organization?.industryType} />
          <DataRow label="Organization Type" value={data.organization?.organizationType} />
          <DataRow label="Ownership Type" value={data.organization?.ownershipType} />
          <DataRow label="Product Categories" value={data.organization?.productCategories?.join(', ')} />
        </div>
      </div>

      <div className="form-section">
        <SectionHeader icon={MapPin} title="Address Information" step={2} onEdit={onEditStep} />
        <div className="space-y-1">
          <DataRow label="Registered Address" value={data.address?.registeredAddress} />
          <DataRow label="City" value={data.address?.registeredCity} />
          <DataRow label="State" value={data.address?.registeredState} />
          <DataRow label="PIN Code" value={data.address?.registeredPincode} />
        </div>
      </div>

      <div className="form-section">
        <SectionHeader icon={Users} title="Contact Information" step={3} onEdit={onEditStep} />
        <div className="space-y-1">
          <DataRow label="CEO/MD Name" value={data.contact?.ceoName} />
          <DataRow label="CEO/MD Email" value={data.contact?.ceoEmail} />
          <DataRow label="CEO/MD Phone" value={data.contact?.ceoPhone} />
        </div>
      </div>

      <div className="form-section">
        <SectionHeader icon={FileCheck} title="Compliance & Statutory" step={4} onEdit={onEditStep} />
        <div className="space-y-1">
          <DataRow label="PAN" value={data.statutory?.pan} />
          <DataRow label="Entity Type" value={data.statutory?.entityType} />
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
          <DataRow label="MSME Registered" value={data.statutory?.isMsmeRegistered ? 'Yes' : 'No'} />
          {data.statutory?.isMsmeRegistered && (
            <>
              <DataRow label="MSME Category" value={data.statutory?.msmeCategory} />
              <DataRow label="MSME Number" value={data.statutory?.msmeNumber} />
            </>
          )}
        </div>
      </div>

      <div className="form-section">
        <SectionHeader icon={Landmark} title="Bank Details" step={5} onEdit={onEditStep} />
        <div className="space-y-1">
          <DataRow label="Bank Name" value={data.bank?.bankName} />
          <DataRow label="Account Number" value={data.bank?.accountNumber?.replace(/./g, '•').slice(0, -4) + data.bank?.accountNumber?.slice(-4)} />
          <DataRow label="IFSC Code" value={data.bank?.ifscCode} />
          <DataRow label="Branch" value={data.bank?.branchName} />
        </div>
      </div>

      <div className="form-section">
        <SectionHeader icon={TrendingUp} title="Financial Information" step={6} onEdit={onEditStep} />
        <div className="space-y-1">
          <DataRow label="Expected Credit Period" value={data.financial?.creditPeriodExpected ? `${data.financial.creditPeriodExpected} days` : '-'} />
          <DataRow label="Major Customer 1" value={data.financial?.majorCustomer1} />
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title"><CheckCircle2 className="h-5 w-5 text-primary" />Declaration & Submission</h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <Checkbox id="selfDeclared" checked={selfDeclared} onCheckedChange={(checked) => setSelfDeclared(checked === true)} />
            <Label htmlFor="selfDeclared" className="text-sm font-normal cursor-pointer">I declare that the information furnished above is correct to the best of my knowledge. I undertake that I will inform you of any changes in the above at the earliest.</Label>
          </div>
          <div className="flex items-start space-x-3">
            <Checkbox id="termsAccepted" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} />
            <Label htmlFor="termsAccepted" className="text-sm font-normal cursor-pointer">I accept the Terms and Conditions and Privacy Policy of Ramky Infrastructure Limited.</Label>
          </div>
        </div>
      </div>
    </div>
  );
}
