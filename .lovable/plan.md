## Fix: State + Accounting Group alignment in Organization Profile

**Problem:** The new State and Accounting Group fields render at half the width of the surrounding paired fields (Ownership / Product Categories). Cause: I wrapped them in a nested `grid md:grid-cols-2`, which sub-divides their parent cell instead of letting them flow as direct siblings of the outer grid (which already pairs children 2-per-row at desktop).

**File:** `src/components/vendor/steps/OrganizationStep.tsx`

Replace the nested wrapper around State + Accounting Group (lines 351–397) so each field becomes a direct sibling of the parent grid, mirroring how `Ownership` and `Product Categories` are laid out:

```tsx
<div className="grid gap-1.5">
  <Label>State *</Label>
  <Controller name="state" ... />
  {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
</div>

<div className="grid gap-1.5">
  <Label>Accounting Group *</Label>
  <Controller name="accountingGroup" ... />
  {errors.accountingGroup && <p className="text-xs text-destructive">{errors.accountingGroup.message}</p>}
</div>
```

This removes the outer `<div className="grid md:grid-cols-2 gap-5">` wrapper but keeps both Controllers and their option lists exactly as they are.

## Out of scope
- No changes to schema, types, or any other field.
- No SAP / backend changes.
