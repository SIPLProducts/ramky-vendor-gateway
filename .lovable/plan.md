## Changes

### 1. `src/pages/AdminInvitations.tsx` — Invitation History table
- Remove the **Reference #** column (header + the `<VendorReferenceCell>` cell + drop the now-unused import).
- Add a **Buyer Company** column placed between Vendor Name and Email.
  - Extend both invitations queries' `select` from `'*, vendor:vendors(id, reference_number, status)'` to `'*, vendor:vendors(id, reference_number, status), tenants(id, name)'` (the `tenant_id` FK already exists on `vendor_invitations`).
  - Render `(invitation as any).tenants?.name ?? '—'` in the new cell.

### 2. `src/components/layout/EnterpriseHeader.tsx` — Buyer "All" option
- Currently the `All Tenants` entry is shown only for super-admin (`isSuperAdmin && <SelectItem value="__all__">`).
- Show it whenever the switcher renders (i.e. drop the `isSuperAdmin` gate). This lets a Buyer with one or more assigned tenants pick "All Tenants" so the Dashboard / All Vendors show data across every tenant they have access to.
- No change to who sees the switcher (Buyer / Admin / Sharvi Admin still see it; SCM / Finance / CEO remain hidden).

### 3. `src/pages/Dashboard.tsx` — date range picker
The `DatePickerButton` currently passes `max={dateTo}` on From and `min={dateFrom}` on To, so the Calendar's `disabled` callback greys out everything outside the current range. That makes it impossible to widen the range without bouncing between the two pickers, which is the "unable to select" symptom.

Fix:
- Remove the `min` / `max` props from both `<DatePickerButton>` calls.
- Wrap the setters so the range self-corrects:
  ```ts
  const handleFromChange = (d: Date) => {
    setDateFrom(startOfDay(d));
    if (d > dateTo) setDateTo(endOfDay(d));
  };
  const handleToChange = (d: Date) => {
    setDateTo(endOfDay(d));
    if (d < dateFrom) setDateFrom(startOfDay(d));
  };
  ```
- In `DatePickerButton`, drop the `disabled` predicate entirely so every day in the calendar is selectable.
- Also add a small **Clear filters** button next to the pickers that resets `dateFrom`/`dateTo` to the default (last 30 days → today). This addresses the "clear based on filtering" ask — users currently have no way to reset after they have narrowed/widened the range.

The query already keys on `fromIso`/`toIso`, so React Query refetches automatically on every change.

## Out of scope
- No DB / RLS / migration changes.
- No edits to the approval-stage pages, edge functions, or `VendorStatus.tsx`.
- The Invite / Create-Vendor dialogs keep their existing tenant scoping.

## Files touched
- `src/pages/AdminInvitations.tsx`
- `src/components/layout/EnterpriseHeader.tsx`
- `src/pages/Dashboard.tsx`
