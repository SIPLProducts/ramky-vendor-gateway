export const STATUS_ROUTING: Record<string, { column: string; skip: string } | null> = {
  submitted: null,
  validation_pending: null,
  returned_to_buyer: null,
  buyer_review: null,
  scm_manager_review: { column: 'scm_manager_user_id', skip: 'skip_scm_manager' },
  scm_head_review: { column: 'scm_head_user_id', skip: 'skip_scm_head' },
  finance_1_review: { column: 'finance_1_user_id', skip: 'skip_finance_1' },
  finance_2_review: { column: 'finance_2_user_id', skip: 'skip_finance_2' },
  ceo_office_review: { column: 'ceo_office_user_id', skip: 'skip_ceo_office' },
};

export function assignedApprover(status: string, buyerId: string | null, flow: Record<string, any> | undefined): string | null {
  if (!Object.prototype.hasOwnProperty.call(STATUS_ROUTING, status)) return null;
  const routing = STATUS_ROUTING[status];
  if (!routing) return buyerId;
  if (!flow || flow[routing.skip]) return null;
  return typeof flow[routing.column] === 'string' ? flow[routing.column] : null;
}