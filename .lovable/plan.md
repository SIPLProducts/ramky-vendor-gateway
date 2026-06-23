Plan:

1. Fix Step 2 Continue navigation reliably
   - Update the vendor registration navigation so the Continue button submits the currently visible step form instead of relying on a shared `step-form` id.
   - Give each mounted step a unique form id, at minimum:
     - Step 1: `step-form-1`
     - Step 2: `step-form-2`
     - Step 3+: matching current step ids or a computed active form id.
   - Update the Continue button and sticky action bar to use the active step form id.
   - This prevents any hidden/previous form from capturing the click and blocking movement to the next tab.

2. Make Organization step validation visible
   - If Step 2 validation fails, show the missing required field messages clearly and keep the button behavior consistent.
   - Ensure Buyer Company is correctly registered in the form state when it is assigned from the invitation/tenant.

3. Add SAP payload key `IDCATG`
   - Map SAP key `IDCATG` from database field `msme_major_activity`.
   - Add it in the client SAP payload builder so SAP Sync preview/send includes it.
   - Add it in the single-vendor edge function normalization path so the deployed backend also sends it.
   - Add it in the bulk SAP sync path so multi-sync sends the same key.
   - Keep the value blank when MSME major activity is unavailable.

4. Verify
   - Check domestic registration flow: Step 1 complete → Step 2 required fields → Continue goes to Address tab.
   - Check generated SAP payload includes `IDCATG: <vendor.msme_major_activity>` for MSME vendors.
   - Ensure no BP_LIFNR/VENDOR behavior is changed by this fix.