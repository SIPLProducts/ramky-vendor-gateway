import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { TrendingUp, Users, Building } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUpload } from '@/components/vendor/FileUpload';
import { FinancialDetails } from '@/types/vendor';

const currentYear = new Date().getFullYear();

const schema = z.object({
  turnoverYear1: z.string().optional(),
  turnoverYear2: z.string().optional(),
  turnoverYear3: z.string().optional(),
  creditPeriodExpected: z.string().optional(),
  majorCustomer1: z.string().optional(),
  majorCustomer2: z.string().optional(),
  majorCustomer3: z.string().optional(),
  authorizedDistributorName: z.string().optional(),
  authorizedDistributorAddress: z.string().optional(),
});

interface FinancialStepProps {
  data: FinancialDetails;
  onNext: (data: FinancialDetails) => void;
  onBack: () => void;
}

export function FinancialStep({ data, onNext }: FinancialStepProps) {
  const [dealershipCertificateFile, setDealershipCertificateFile] = useState<File | null>(data.dealershipCertificateFile);
  const [financialDocsFile, setFinancialDocsFile] = useState<File | null>(data.financialDocsFile);
  const { register, handleSubmit } = useForm<FinancialDetails>({ resolver: zodResolver(schema), defaultValues: data });

  const handleFormSubmit = (formData: FinancialDetails) => {
    onNext({ ...formData, dealershipCertificateFile, financialDocsFile });
  };

  return (
    <form id="step-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title"><TrendingUp className="h-5 w-5 text-primary" />Audited Turnover (Last 3 Years)</h3>
        <Alert className="mb-5"><AlertDescription>Please provide CA certified copies of audited financial statements</AlertDescription></Alert>
        <div className="grid gap-5">
          <div className="grid md:grid-cols-3 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="turnoverYear1">FY {currentYear - 3}-{(currentYear - 2).toString().slice(-2)}</Label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span><Input id="turnoverYear1" type="number" {...register('turnoverYear1')} placeholder="Enter amount" className="pl-8" /></div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="turnoverYear2">FY {currentYear - 2}-{(currentYear - 1).toString().slice(-2)}</Label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span><Input id="turnoverYear2" type="number" {...register('turnoverYear2')} placeholder="Enter amount" className="pl-8" /></div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="turnoverYear3">FY {currentYear - 1}-{currentYear.toString().slice(-2)}</Label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span><Input id="turnoverYear3" type="number" {...register('turnoverYear3')} placeholder="Enter amount" className="pl-8" /></div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="creditPeriodExpected">Expected Credit Period (Days)</Label>
            <Input id="creditPeriodExpected" type="number" {...register('creditPeriodExpected')} placeholder="e.g., 30, 45, 60" />
          </div>
          <FileUpload label="Upload Audited Financial Statements (CA Certified)" accept=".pdf" documentType="financial_docs" onFileSelect={setFinancialDocsFile} currentFile={financialDocsFile} />
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title"><Users className="h-5 w-5 text-primary" />Existing Major Customers</h3>
        <div className="grid gap-5">
          <div className="grid gap-1.5"><Label htmlFor="majorCustomer1">Customer 1</Label><Input id="majorCustomer1" {...register('majorCustomer1')} placeholder="Company name" /></div>
          <div className="grid gap-1.5"><Label htmlFor="majorCustomer2">Customer 2</Label><Input id="majorCustomer2" {...register('majorCustomer2')} placeholder="Company name" /></div>
          <div className="grid gap-1.5"><Label htmlFor="majorCustomer3">Customer 3</Label><Input id="majorCustomer3" {...register('majorCustomer3')} placeholder="Company name" /></div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title"><Building className="h-5 w-5 text-primary" />Authorized Distributor Details</h3>
        <p className="text-sm text-muted-foreground mb-4">For Trader/Dealer/Authorized Distributor: Please attach relevant valid dealership certificates</p>
        <div className="grid gap-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div className="grid gap-1.5"><Label htmlFor="authorizedDistributorName">Name</Label><Input id="authorizedDistributorName" {...register('authorizedDistributorName')} placeholder="Distributor/Dealer name" /></div>
            <div className="grid gap-1.5"><Label htmlFor="authorizedDistributorAddress">Address</Label><Input id="authorizedDistributorAddress" {...register('authorizedDistributorAddress')} placeholder="Distributor address" /></div>
          </div>
          <FileUpload label="Upload Dealership Certificate" accept=".pdf,.jpg,.jpeg,.png" documentType="dealership_certificate" onFileSelect={setDealershipCertificateFile} currentFile={dealershipCertificateFile} />
        </div>
      </div>
    </form>
  );
}
