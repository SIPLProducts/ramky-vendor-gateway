## Problem

In the Document Verification step (GST tab), after uploading a GST certificate, the **Principal Place of Business** field sometimes shows the address read by OCR from the certificate scan (e.g. `-, 15-80, -, SELAPADU, CHEBROLU, Guntur, Andhra Pradesh, 522213`) instead of the address returned by the GST registry validation API (e.g. `Ground Floor, 11, Revathi, 2nd Cross, George Garden, RVCE Post, Mysore Road, Bengaluru Urban, Karnataka, 560059`).

The registry response is the authoritative source of truth — it must always win over the OCR value (or any stale value persisted from a previous upload/navigation).

## Root cause

In `src/components/vendor/steps/DocumentVerificationStep.tsx`:

1. Line 273-275 initializes `editablePrincipalPlace` from previously persisted `initialData.gst.principalPlaceOfBusiness || address` once at mount.
2. After `handleGstUpload` runs, line 798-799 only sets the field **if `!editablePrincipalPlace`**:
   ```ts
   if (principal && !editablePrincipalPlace) setEditablePrincipalPlace(principal);
   ```
   So if the field already had a value (from a previous upload, or from the OCR's `principal_place_of_business` that was hydrated before the API merge), the new registry address never overwrites it.
3. The OCR extracted from the certificate image and the GST registry address can legitimately differ (e.g. OCR misreads, additional places, or the user uploaded the wrong cert). When they differ, the registry value should be the displayed/saved value.

## Fix

In `src/components/vendor/steps/DocumentVerificationStep.tsx`:

1. **`handleGstUpload` (~line 795-802)**: after `runDocFlow` resolves, always overwrite `editablePrincipalPlace` with the API-normalized address when present:
   ```ts
   const apiAddress = prev.apiData?.normalized?.principal_place_of_business
                    || prev.apiData?.normalized?.address;
   if (apiAddress) setEditablePrincipalPlace(apiAddress);
   else if (!editablePrincipalPlace) setEditablePrincipalPlace(prev.ocrData?.principal_place_of_business || prev.ocrData?.address || "");
   ```
   This guarantees the registry value always replaces the OCR-derived value once verification succeeds.

2. **Verified panel (~line 2604-2625)**: keep the field editable but show a small "Auto-filled from registry" hint when the current value matches `api.address`, so the vendor understands the source. (The existing "Matches registry address" success line already covers this — no UI change needed beyond making sure the auto-fill happens.)

3. **Persistence (~line 1113-1114)**: no change. The `out` payload already prefers `editablePrincipalPlace` when present, and we are now setting it from the registry.

## Out of scope

- No changes to the GST_OCR / GST validation providers or to `kyc-api-execute`.
- No changes to `ComplianceStep.tsx` or `ReviewStep.tsx` — they read the value already saved by this step.
- No DB schema changes.
