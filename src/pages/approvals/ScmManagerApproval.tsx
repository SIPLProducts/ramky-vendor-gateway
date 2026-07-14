import { ShoppingCart } from 'lucide-react';
import { StageApprovalView } from '@/components/approvals/StageApprovalView';

export default function ScmManagerApproval() {
  return (
    <StageApprovalView
      stage="SCM_MANAGER"
      title="SCM CO"
      
      Icon={ShoppingCart}
    />
  );
}
