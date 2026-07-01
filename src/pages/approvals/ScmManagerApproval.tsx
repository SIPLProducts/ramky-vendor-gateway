import { ShoppingCart } from 'lucide-react';
import { StageApprovalView } from '@/components/approvals/StageApprovalView';

export default function ScmManagerApproval() {
  return (
    <StageApprovalView
      stage="SCM_MANAGER"
      title="SCM CO"
      subtitle="Vendors waiting for SCM CO (L2..Ln) review."
      Icon={ShoppingCart}
    />
  );
}
