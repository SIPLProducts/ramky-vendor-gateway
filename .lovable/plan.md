## Tenants Select All + Default-Selected

Update the Create User dialog so SAP-fetched tenants are easier to manage in bulk.

### Changes (frontend only)

**File:** `src/components/admin/CreateUserDialog.tsx`

1. **Auto-select all on fetch** — In `fetchSapTenants`, after setting `sapTenants`, initialize `selectedCodes` to all returned codes (`list.map(t => t.code)`) instead of `[]`.

2. **Add "Select All" row** — Above the tenant checkbox list (only when `sapTenants.length > 0`), render a sticky row with:
   - A `Checkbox` whose state is:
     - checked → all selected
     - unchecked → none selected
     - indeterminate → partial (use Radix `data-state="indeterminate"` via `checked="indeterminate"`)
   - Label "Select All" + a small count `({selectedCodes.length}/{sapTenants.length})`
   - onCheckedChange: if currently all selected → clear; otherwise → select all codes.

3. **Preserve individual toggles** — Existing `toggleCode` behavior remains; users can deselect/reselect any tenant.

4. **Refresh behavior** — When user clicks Refresh or re-fetches, the new list is again fully selected by default.

No backend/edge function changes needed — `admin-create-user` already accepts the selected `sap_tenants` array.

### Visual

```text
Tenants * (from SAP)                     [Refresh]
┌──────────────────────────────────────┐
│ [✓] Select All            (10/10)    │
│ ────────────────────────────────────  │
│ [✓] SAP A.G. (0001)                  │
│ [✓] Ramky Infrastructure Ltd (1000)  │
│ [✓] BLOCKED NOT IN USE (1101)        │
│ ...                                  │
└──────────────────────────────────────┘
```
