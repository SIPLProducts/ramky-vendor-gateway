import { ShieldCheck } from 'lucide-react';
import { StageApprovalView } from '@/components/approvals/StageApprovalView';

export default function ScmHeadApproval() {
  return (
    <StageApprovalView
      stage="SCM_HEAD"
      title="SCM Head Approval"
      
      Icon={ShieldCheck}
    />
  );
}
