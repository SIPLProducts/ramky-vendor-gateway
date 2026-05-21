import { IndianRupee, FileCheck2 } from 'lucide-react';
import { StageApprovalView } from '@/components/approvals/StageApprovalView';
import { Badge } from '@/components/ui/badge';

export default function Finance2Approval() {
  return (
    <StageApprovalView
      stage="FINANCE_2"
      title="Finance 2 Approval"
      subtitle="Validate MSME status, GST compliance and (optional) declaration before final finance sign-off."
      Icon={IndianRupee}
      extraPanel={(item) => (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-muted-foreground" />
            <strong>Compliance checks for {item.vendorName}</strong>
          </div>
          {item.isInternational ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-32">Vendor type:</span>
              <Badge variant="outline">International — will route to SAP Sync</Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-32">MSME registered:</span>
              {item.isMsme
                ? <Badge variant="secondary">Yes — will route to CEO Office</Badge>
                : <Badge variant="outline">No — will route to SAP Sync</Badge>}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Confirm GST compliance and (if applicable) the declaration upload from the vendor's record before approving.
          </p>
        </div>
      )}
    />
  );
}
