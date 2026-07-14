import { IndianRupee } from 'lucide-react';
import { StageApprovalView } from '@/components/approvals/StageApprovalView';

export default function Finance1Approval() {
  return (
    <StageApprovalView
      stage="FINANCE_1"
      title="Finance 1 Approval"
      
      Icon={IndianRupee}
    />
  );
}
