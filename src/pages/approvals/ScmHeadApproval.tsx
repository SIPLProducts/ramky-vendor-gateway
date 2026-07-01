import { ShieldCheck } from 'lucide-react';
import { StageApprovalView } from '@/components/approvals/StageApprovalView';

export default function ScmHeadApproval() {
  return (
    <StageApprovalView
      stage="SCM_HEAD"
      title="SCM Head Approval"
      subtitle="Vendors that have cleared SCM CO review and need final SCM sign-off."
      Icon={ShieldCheck}
    />
  );
}
