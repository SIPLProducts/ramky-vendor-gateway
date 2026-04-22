

## Re-assign Brijesh & soumendukumar approval matrix to RIL

### Current state (verified in DB)

| Tenant | Levels configured |
|---|---|
| Ramky Energy & Environment (REEL) | L1 Brijesh kabra, L2 soumendukumar ✅ |
| **Ramky Infrastructure Limited (RIL)** | **none** ❌ |
| REE / REF / RPC | none |

You wanted both approvers on **RIL** (where the 15 vendors live). They were saved to REEL by mistake because the tenant switcher in Approval Matrix was on REEL when you hit Save All.

### Fix — two options, pick one

**Option A · Move the existing rows from REEL → RIL** (recommended if REEL should have no approvers)
- Reassign the two `approval_matrix_levels` rows currently under REEL to RIL's `tenant_id`.
- Approvers (`approval_matrix_approvers`) stay attached to the same levels — they move automatically.
- Net result: REEL becomes empty, RIL gets L1 Brijesh + L2 soumendukumar.

**Option B · Copy to RIL, keep REEL as-is** (if both tenants should have these approvers)
- Insert two new `approval_matrix_levels` rows under RIL (L1, L2, mode ANY).
- Insert matching `approval_matrix_approvers` rows with the same name + email.
- Net result: both REEL and RIL have the two approvers.

### How it gets done

1. In Admin Configuration → Approval Matrix, switch the **Tenant** dropdown to **Ramky Infrastructure Limited**. The new tenant switcher in the top header should make this obvious.
2. I'll run a one-shot DB update to apply Option A or B (whichever you pick) so you don't have to re-type the names/emails.
3. Verify: refresh the page on RIL → you should see L1 Brijesh, L2 soumendukumar.
4. Any vendor in RIL submitted after this point routes to Brijesh first, then soumendukumar.

### Out of scope

- No schema or RLS changes.
- No edge function changes.
- No effect on the 15 RIL vendors already in the system — newly submitted ones will pick up the matrix; existing in-flight ones keep their current routing.

**Tell me Option A or Option B and I'll execute it.**

