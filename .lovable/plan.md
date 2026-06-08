## Plan

1. **Make the Ramky logo transparent**
   - Convert the current logo files to PNG with an alpha channel.
   - Remove the white/background area so it displays cleanly on the portal UI.
   - Replace both logo locations used by the app:
     - `src/assets/ramky-logo.png`
     - `public/ramky-logo.png`

2. **Fix the create-vendor submit error**
   - Add a new database migration that replaces `seed_vendor_approval_progress` with a safe version.
   - Initialize the buyer approval flow record before reading `v_flow.id`, so submission does not fail when:
     - buyer flow is missing, or
     - no matching buyer approval flow row is found.
   - Preserve the existing behavior for buyer-created applications:
     - buyer step auto-approved when `created_on_behalf = true`
     - approval stages seeded from `buyer_approval_flows`
     - vendor status moved to the first pending stage

3. **Validate after implementation**
   - Confirm the logo files have transparency.
   - Confirm the database function no longer contains the unassigned `v_flow` access pattern.
   - Check backend logs again for the same `v_flow` error after the migration is applied.