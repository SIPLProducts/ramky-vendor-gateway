import { UserCheck } from 'lucide-react';
import { StageApprovalView } from '@/components/approvals/StageApprovalView';

export default function BuyerApproval() {
  return (
    <StageApprovalView
      stage="BUYER"
      title="Buyer Approval"
      subtitle="Review and verify vendor applications before they are forwarded to SCM CO."
      Icon={UserCheck}
    />
  );
}
