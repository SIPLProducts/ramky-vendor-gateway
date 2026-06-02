## Problem

After uploading documents in Step 1 (Document Verification), the GST address auto-fills **Address Line 1** in the Address step (e.g. *"PLOT NO 52, ..., Hyderabad, Rangareddy, Telangana, 500097"*), but:

1. **City / State / PIN Code** in the Address step stay empty.
2. **State** in the Organization step shows a stale value (e.g. *"Himachal Pradesh"*) instead of the value from the document.

## Root cause

In `DocumentVerificationStep.tsx`, the helper `pickAddressParts(...)` only extracts city/state/pincode when the KYC provider returns a **structured** Principal Address object (Surepass-style `pradr.addr` with `city / stcd / pncd`). When the provider returns the Principal Place of Business as a **plain string** (which is what the current Surepass response gives for this vendor), no parts are detected, so the GST payload's `addressParts` is `undefined`. Downstream:

- `mergeVerifiedDataIntoForm` in `VendorRegistration.tsx` reads `data.gst?.addressParts?.city/state/pincode` → all `undefined` → Address Step fields stay blank.
- The same merge never writes to `organization.state`, so the Organization Step's State dropdown keeps whatever was previously saved.

## Fix

### 1. Parse plain-string GST address into parts
In `src/components/vendor/steps/DocumentVerificationStep.tsx`, when `pickAddressParts(...)` returns empty, add a string-based fallback that parses the registry address string (`registryAddress`):

- Extract **PIN code** = trailing 6-digit number.
- Extract **State** = match the trailing comma-segment against the known Indian state list (case-insensitive). Fall back to `jurisdiction_state` with the `State -` prefix stripped (already done for `address_state`).
- Extract **City** = the comma-segment immediately before the state (skipping district names if a known state matches earlier).

Feed the parsed parts into the existing `normalized.address_city / address_state / address_pincode / address_line` so the rest of the pipeline (already wired) carries them up through `addressParts`.

### 2. Auto-fill Organization Step state
In `src/pages/VendorRegistration.tsx → mergeVerifiedDataIntoForm`, also populate `organization.state` using the same `stateFromDoc` value (with `fill` semantics, so a vendor-typed value still wins). Normalize the value to match the Organization Step state dropdown options (Title Case, trimmed) before assigning.

### 3. Same fallback for MSME plain-string address
Apply the same string-parsing fallback for MSME's `office_address` when structured `city / state / pin_code` fields are missing, so MSME-only vendors also get City/State/PIN auto-filled.

## Files to change

- `src/components/vendor/steps/DocumentVerificationStep.tsx` — add string-address parser; use it inside the GST `normalized` block and the MSME `addressParts` block.
- `src/pages/VendorRegistration.tsx` — extend `mergeVerifiedDataIntoForm` to also fill `organization.state` from `stateFromDoc`.

## Out of scope

- No changes to KYC provider configuration, edge functions, DMS, or SAP payloads.
- No changes to vendor-typed precedence rules (vendor edits still win over OCR).
- No schema or RLS changes.
