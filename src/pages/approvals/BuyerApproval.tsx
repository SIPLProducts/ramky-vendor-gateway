import { UserCheck } from 'lucide-react';
import { StageApprovalView } from '@/components/approvals/StageApprovalView';

export default function BuyerApproval() {
  return (
    <StageApprovalView
      stage="BUYER"
      title="Buyer Approval"
      subtitle="Vendors you invited that are waiting for your verification before moving to SCM Manager."
      Icon={UserCheck}
    />
  );
}
