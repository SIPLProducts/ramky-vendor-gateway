## Changes

### 1. AdminInvitations — Resume + Resend Email (`src/pages/AdminInvitations.tsx`)

**Resume button** currently only shows when `isOnBehalf && !used_at && status !== 'expired'`. The 3rd row (PHARMAFFILIATES – On behalf, In Progress) has `used_at` set (vendor clicked link earlier) so Resume is hidden.

Fix: show Resume for any on-behalf row with status `in_progress` or `used`, regardless of `used_at`:

```ts
const canResumeOnBehalf = isOnBehalf && (status === 'in_progress' || status === 'used');
```

**Send Email → Resend Email** for Pending: change the label so pending rows also say "Resend Email":

```ts
const resendLabel = status === 'expired' ? 'Resend Invitation' : 'Resend Email';
```

Also allow Resend to appear on on-behalf rows too (currently blocked by `!isOnBehalf`) so on-behalf rows show both Resume + Resend:

```ts
const showResend = status === 'pending' || status === 'used' || status === 'in_progress' || status === 'expired';
```

### 2. Move Reference Number search to Dashboard

Move the "Enter Reference Number + Search" form (with `handleTrackByReference` logic — looks up `vendors.reference_number` and navigates to `/vendor-status/:id`) from AdminInvitations to Dashboard header (`src/pages/Dashboard.tsx`), placed next to the Export button in the header actions row.

Remove the form and related state (`trackRef`, `isTracking`, `handleTrackByReference`, `Search` icon import if unused) from AdminInvitations.

### Out of scope
No DB, RLS, edge-function, or auto-save changes.

### Verification
`bunx tsgo --noEmit` clean; visually confirm Resume shows on PHARMAFFILIATES row, Pending row shows "Resend Email", Dashboard header has the reference search.
