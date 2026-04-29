import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FlaskConical, RotateCw } from 'lucide-react';
import { KycTabs, KycStatus } from '@/components/vendor/kyc/KycTabs';
import { GstKycTab } from '@/components/vendor/kyc/GstKycTab';
import { PanKycTab } from '@/components/vendor/kyc/PanKycTab';
import { MsmeKycTab } from '@/components/vendor/kyc/MsmeKycTab';
import { BankKycTab } from '@/components/vendor/kyc/BankKycTab';

/**
 * Admin-only "Live Test" panel that mirrors the exact KYC capture & verify
 * experience vendors see in the registration form. It lets admins try the
 * configured OCR + validation APIs end-to-end without leaving settings.
 */
export function KycLiveTestPanel() {
  // Test name used for name-match checks across all 4 tabs
  const [legalName, setLegalName] = useState('');

  // GST
  const [isGstRegistered, setIsGstRegistered] = useState(true);
  const [gstin, setGstin] = useState('');
  const [gstCertFile, setGstCertFile] = useState<File | null>(null);
  const [gstSelfDeclFile, setGstSelfDeclFile] = useState<File | null>(null);
  const [gstDeclReason, setGstDeclReason] = useState('');

  // PAN
  const [pan, setPan] = useState('');
  const [panCardFile, setPanCardFile] = useState<File | null>(null);

  // MSME
  const [isMsmeRegistered, setIsMsmeRegistered] = useState(true);
  const [msmeNumber, setMsmeNumber] = useState('');
  const [msmeCertFile, setMsmeCertFile] = useState<File | null>(null);

  // Bank
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [cancelledChequeFile, setCancelledChequeFile] = useState<File | null>(null);

  // Tab statuses
  const [statuses, setStatuses] = useState<Record<'gst' | 'pan' | 'msme' | 'bank', KycStatus>>({
    gst: 'idle', pan: 'idle', msme: 'idle', bank: 'idle',
  });
  const setStatus = (k: keyof typeof statuses, s: KycStatus) =>
    setStatuses((prev) => (prev[k] === s ? prev : { ...prev, [k]: s }));

  const [activeTab, setActiveTab] = useState<'gst' | 'pan' | 'msme' | 'bank'>('gst');

  const handleReset = () => {
    setGstin(''); setPan(''); setMsmeNumber('');
    setBankAccountNumber(''); setIfscCode('');
    setGstCertFile(null); setGstSelfDeclFile(null); setGstDeclReason('');
    setPanCardFile(null); setMsmeCertFile(null); setCancelledChequeFile(null);
    setStatuses({ gst: 'idle', pan: 'idle', msme: 'idle', bank: 'idle' });
  };

  return (
    <div className="space-y-4">
      <Alert className="border-primary/30 bg-primary/5">
        <FlaskConical className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          This panel uses the <strong>same components</strong> vendors see during registration. Any
          OCR upload or manual verification here calls the configured KYC APIs end-to-end so you can
          confirm everything works before going live.
        </AlertDescription>
      </Alert>

      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="grid gap-1.5 flex-1">
            <Label htmlFor="testLegalName">Test Legal Name (optional)</Label>
            <Input
              id="testLegalName"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Used for name-match checks against PAN / GST / MSME / Bank"
            />
          </div>
          <Button type="button" variant="outline" onClick={handleReset} className="sm:w-auto">
            <RotateCw className="h-4 w-4 mr-2" /> Reset all tabs
          </Button>
        </div>
      </Card>

      <KycTabs
        active={activeTab}
        onActiveChange={setActiveTab}
        statuses={statuses}
        gst={
          <GstKycTab
            isGstRegistered={isGstRegistered}
            onIsGstRegisteredChange={setIsGstRegistered}
            gstin={gstin}
            onGstinChange={setGstin}
            legalName={legalName || undefined}
            gstCertificateFile={gstCertFile}
            onGstCertificateFileChange={setGstCertFile}
            gstSelfDeclarationFile={gstSelfDeclFile}
            onGstSelfDeclarationFileChange={setGstSelfDeclFile}
            gstDeclarationReason={gstDeclReason}
            onGstDeclarationReasonChange={setGstDeclReason}
            onStatusChange={(s) => setStatus('gst', s)}
          />
        }
        pan={
          <PanKycTab
            pan={pan}
            onPanChange={setPan}
            legalName={legalName || undefined}
            panCardFile={panCardFile}
            onPanCardFileChange={setPanCardFile}
            onStatusChange={(s) => setStatus('pan', s)}
          />
        }
        msme={
          <MsmeKycTab
            isMsmeRegistered={isMsmeRegistered}
            onIsMsmeRegisteredChange={setIsMsmeRegistered}
            msmeNumber={msmeNumber}
            onMsmeNumberChange={setMsmeNumber}
            legalName={legalName || undefined}
            msmeCertificateFile={msmeCertFile}
            onMsmeCertificateFileChange={setMsmeCertFile}
            onStatusChange={(s) => setStatus('msme', s)}
          />
        }
        bank={
          <BankKycTab
            bankAccountNumber={bankAccountNumber}
            ifscCode={ifscCode}
            onBankDetailsChange={(b) => {
              setBankAccountNumber(b.bankAccountNumber);
              setIfscCode(b.ifscCode);
            }}
            legalName={legalName || undefined}
            cancelledChequeFile={cancelledChequeFile}
            onCancelledChequeFileChange={setCancelledChequeFile}
            onStatusChange={(s) => setStatus('bank', s)}
          />
        }
      />
    </div>
  );
}
