import { FileUpload } from '@/components/vendor/FileUpload';
import { FileText } from 'lucide-react';
import { InternationalDocuments } from '@/types/vendor';

interface Props {
  vendorId?: string | null;
  data: InternationalDocuments;
  onChange: (data: InternationalDocuments) => void;
}

export function IntlDocumentsStep({ vendorId, data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title">
          <FileText className="h-5 w-5 text-primary" />
          Documents Upload
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload your registration document and SWIFT/IBAN details (optional). Accepted formats: PDF, JPG, PNG (up to 5MB).
        </p>
        <div className="grid md:grid-cols-2 gap-5">
          <FileUpload
            label="Registration Copy"
            vendorId={vendorId || undefined}
            documentType="registration_copy"
            currentFile={data.registrationCopyFile}
            onFileSelect={(file) => onChange({ ...data, registrationCopyFile: file })}
          />
          <FileUpload
            label="SWIFT / IBAN Details"
            vendorId={vendorId || undefined}
            documentType="swift_iban_details"
            currentFile={data.swiftIbanFile}
            onFileSelect={(file) => onChange({ ...data, swiftIbanFile: file })}
          />
        </div>
      </div>
    </div>
  );
}
