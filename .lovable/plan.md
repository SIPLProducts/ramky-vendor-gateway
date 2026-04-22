

## Make the Approval Matrix save flow impossible to silently miss

### What's actually wrong

Database check confirms `approval_matrix_levels` and `approval_matrix_approvers` are **completely empty**, and there is **no `approval_matrix_saved` audit log** for the past day. The Save All click is either being blocked by validation, throwing an error the user dismissed, or the row state was never populated. The save logic itself is correct and RLS permits writes for your `sharvi_admin` role.

### Fixes

**1. Make Save All explicit and observable** (`src/components/admin/ApprovalMatrixConfig.tsx`)
- Show a **persistent diagnostics panel** above the table while editing: row count, levels grouped, missing fields per row (e.g. "Row 2 · Level 1 · no approver selected"), and a green check when all rows are valid.
- Replace the validate-then-toast pattern with **inline red highlights** on the offending row + a banner listing every problem; Save All stays disabled until the banner is empty.
- After a successful save, show a **green "Saved · N levels · M approvers"** confirmation strip that stays visible for 10s, plus reload the matrix from DB and display the hydrated row count so the user can confirm round-trip persistence.
- Console-log every step: `[ApprovalMatrix] validating`, `[ApprovalMatrix] upserting level X`, `[ApprovalMatrix] inserting N approvers`, `[ApprovalMatrix] done`.

**2. Surface load state for the existing matrix**
- Add a "Currently in database: N levels, M approvers (last updated …)" line at the top of the card, fetched on mount and after every save. If 0/0, show "Nothing saved yet for this tenant."
- This proves to the user whether prior saves persisted, independent of whatever is in the editor.

**3. Guard against navigation loss**
- If `isDirty` and the user clicks the Tenant dropdown or tries to leave the tab, show a confirm dialog: "Discard unsaved approval matrix changes?"

**4. One-click "Test Save" diagnostic**
- Small "Test write access" button next to Save All (only visible to `sharvi_admin`/`admin`). Inserts a sentinel level, immediately deletes it, and toasts the result. If RLS or network is the problem this surfaces it in one click without touching real data.

**5. Wider warning when user list is loading**
- Today, if `useTenantUsersWithRoles` is still loading, the approver dropdown shows "no users". Add a clear "Loading users…" state inside the combobox so users don't think it's empty and skip selecting an approver.

### Files touched
- `src/components/admin/ApprovalMatrixConfig.tsx` — diagnostics panel, inline row errors, persisted-save confirmation, test-write button, navigation guard, console tracing.

### Out of scope
- No DB schema or RLS change (already verified correct).
- No change to `route-vendor-approval` or downstream approval execution.
- No change to Assign Users dialog (already working — tenants now have users).

### After the fix — what to do
1. Open Approval Matrix → pick **Ramky Infrastructure Limited**.
2. Top strip will show "Currently in database: 0 levels, 0 approvers".
3. Add rows; the diagnostic panel will list any missing fields in real time.
4. When green, click **Save All**. The strip will refresh to show the new counts and a green confirmation banner appears.
5. If anything fails, the exact error message + step will be visible in both the toast and the browser console.

