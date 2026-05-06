import { Crown } from 'lucide-react';
import { StageApprovalView } from '@/components/approvals/StageApprovalView';

export default function CeoApproval() {
  return (
    <StageApprovalView
      stage="CEO_OFFICE"
      title="CEO Office Approval"
      subtitle="Final approval for MSME-registered vendors before they are pushed to SAP."
      Icon={Crown}
    />
  );
}
