import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { VendorFormData } from '@/types/vendor';
import { ChevronLeft, Send, Building2, User, FileText, Building, IndianRupee, Edit2, LucideIcon } from 'lucide-react';
import { useState } from 'react';

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  step: number;
  onEditStep: (step: number) => void;
}

function SectionHeader({ icon: Icon, title, step, onEditStep }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4 pb-2 border-b">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => onEditStep(step)}
        className="text-primary gap-1"
      >
        <Edit2 className="h-4 w-4" />
        Edit
      </Button>
    </div>
  );
}

interface DataRowProps {
  label: string;
  value: string | undefined;
}

function DataRow({ label, value }: DataRowProps) {
  return (
    <div className="py-2 grid grid-cols-2 gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || '-'}</span>
    </div>
  );
}

interface ReviewStepProps {
  data: VendorFormData;
  onSubmit: () => void;
  onBack: () => void;
  onEditStep: (step: number) => void;
}

export function ReviewStep({ data, onSubmit, onBack, onEditStep }: ReviewStepProps) {
  const [selfDeclared, setSelfDeclared] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const canSubmit = selfDeclared && termsAccepted;

  return (
    <div className="space-y-6">
      <div className="form-section">
        <SectionHeader icon={Building2} title="Organization Details" step={1} onEditStep={onEditStep} />
        <div className="divide-y">
          <DataRow label="Legal Name" value={data.organization.legalName} />
          <DataRow label="Trade Name" value={data.organization.tradeName} />
          <DataRow label="Industry Type" value={data.organization.industryType} />
          <DataRow label="Categories" value={data.organization.productCategories?.join(', ')} />
          <DataRow 
            label="Registered Address" 
            value={`${data.organization.registeredAddress}, ${data.organization.registeredCity}, ${data.organization.registeredState} - ${data.organization.registeredPincode}`} 
          />
        </div>
      </div>

      <div className="form-section">
        <SectionHeader icon={User} title="Contact Information" step={2} onEditStep={onEditStep} />
        <div className="divide-y">
          <DataRow label="Primary Contact" value={data.contact.primaryContactName} />
          <DataRow label="Designation" value={data.contact.primaryDesignation} />
          <DataRow label="Email" value={data.contact.primaryEmail} />
          <DataRow label="Phone" value={data.contact.primaryPhone} />
          {data.contact.secondaryContactName && (
            <DataRow label="Secondary Contact" value={data.contact.secondaryContactName} />
          )}
        </div>
      </div>

      <div className="form-section">
        <SectionHeader icon={FileText} title="Documents & Verification" step={3} onEditStep={onEditStep} />
        <div className="divide-y">
          <DataRow label="GSTIN" value={data.statutory.gstin} />
          <DataRow label="PAN" value={data.statutory.pan} />
          <DataRow label="Entity Type" value={data.statutory.entityType} />
          {data.statutory.msmeNumber && (
            <>
              <DataRow label="MSME Number" value={data.statutory.msmeNumber} />
              <DataRow label="MSME Category" value={data.statutory.msmeCategory?.toUpperCase()} />
            </>
          )}
          <DataRow label="Bank Name" value={data.bank.bankName} />
          <DataRow label="Account Type" value={data.bank.accountType === 'current' ? 'Current Account' : 'Savings Account'} />
          <DataRow label="Account Number" value={data.bank.accountNumber ? `XXXX${data.bank.accountNumber.slice(-4)}` : '-'} />
          <DataRow label="IFSC Code" value={data.bank.ifscCode} />
          <DataRow label="Branch" value={data.bank.branchName} />
        </div>
      </div>

      <div className="form-section">
        <SectionHeader icon={IndianRupee} title="Financial Information" step={4} onEditStep={onEditStep} />
        <div className="divide-y">
          <DataRow label="Current Year Turnover" value={data.financial.turnoverYear1 ? `₹ ${data.financial.turnoverYear1}` : undefined} />
          <DataRow label="Previous Year Turnover" value={data.financial.turnoverYear2 ? `₹ ${data.financial.turnoverYear2}` : undefined} />
          <DataRow label="Expected Credit Period" value={data.financial.creditPeriodExpected ? `${data.financial.creditPeriodExpected} Days` : '-'} />
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Declaration & Terms</h3>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-md">
            <Checkbox
              id="selfDeclare"
              checked={selfDeclared}
              onCheckedChange={(checked) => setSelfDeclared(!!checked)}
            />
            <Label htmlFor="selfDeclare" className="font-normal cursor-pointer leading-relaxed">
              I hereby declare that all the information provided above is true, correct, and complete 
              to the best of my knowledge. I understand that any false or misleading information may 
              result in rejection of this application or termination of the vendor relationship.
            </Label>
          </div>

          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-md">
            <Checkbox
              id="termsAccept"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(!!checked)}
            />
            <Label htmlFor="termsAccept" className="font-normal cursor-pointer leading-relaxed">
              I accept the{' '}
              <a href="#" className="text-primary underline">Terms and Conditions</a>
              {' '}and{' '}
              <a href="#" className="text-primary underline">Vendor Code of Conduct</a>
              {' '}of Ramky Infrastructure Limited.
            </Label>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button 
          onClick={onSubmit} 
          disabled={!canSubmit}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          Submit for Verification
        </Button>
      </div>
    </div>
  );
}