# Fix "Region TG is not defined for IN" SAP sync error

## What's happening

Good news: the middleware + proxy secret are now working correctly. The request reached SAP and SAP responded. The remaining failure is a **data mapping issue**, not a connectivity issue.

SAP returned:

```text
Region TG is not defined for IN.
Business Partner: SHARVI INFOTECH PRIVATE LIMITE
```

The vendor's `registered_state = "Telangana"`. The edge function is sending `REGION = "TG"`, but in your SAP system the configured region code for Telangana under country IN is **not** `TG`. We already see proof of this in the same mapping table — Maharashtra is mapped to `"13"` (a numeric T005S code), while every other state still uses 2-letter ISO-style codes. So this SAP system uses **numeric T005S region codes**, not 2-letter codes.

That's why only Maharashtra works today and Telangana (and likely every other state) fails.

## Root cause

In `supabase/functions/sync-vendor-to-sap/index.ts`, the `stateToRegion` map mixes two schemes:

```text
"Maharashtra": "13",   // numeric  <-- accepted by SAP
"Telangana":   "TG",   // alpha    <-- rejected by SAP
"Andhra Pradesh": "AP" // alpha    <-- will also be rejected
... etc
```

SAP table T005S for country `IN` in your system uses numeric codes (the standard SAP India localization), so every alpha entry will fail the same way.

## Fix plan

1. **Update the state → region mapping** in `supabase/functions/sync-vendor-to-sap/index.ts` to use the standard SAP T005S numeric region codes for India:

   ```text
   Andhra Pradesh     -> 01
   Arunachal Pradesh  -> 02
   Assam              -> 03
   Bihar              -> 04
   Chhattisgarh       -> 33
   Goa                -> 05
   Gujarat            -> 06
   Haryana            -> 07
   Himachal Pradesh   -> 08
   Jammu & Kashmir    -> 09
   Karnataka          -> 10
   Kerala             -> 11
   Madhya Pradesh     -> 12
   Maharashtra        -> 13
   Manipur            -> 14
   Meghalaya          -> 15
   Mizoram            -> 16
   Nagaland           -> 17
   Odisha             -> 18
   Punjab             -> 19
   Rajasthan          -> 20
   Sikkim             -> 21
   Tamil Nadu         -> 22
   Tripura            -> 23
   Uttar Pradesh      -> 24
   West Bengal        -> 25
   Andaman & Nicobar  -> 26
   Chandigarh         -> 27
   Dadra & Nagar Haveli -> 28
   Daman & Diu        -> 29
   Delhi              -> 30
   Lakshadweep        -> 31
   Puducherry         -> 32
   Jharkhand          -> 34
   Uttarakhand        -> 35
   Telangana          -> 36
   Ladakh             -> 37
   ```

   Also accept common aliases (e.g. `Orissa` → 18, `Pondicherry` → 32, `J&K` → 09) and do a case-insensitive trimmed lookup so minor casing/whitespace differences in vendor data still resolve.

2. **Make the failure mode friendlier**: if the vendor's `registered_state` is missing or doesn't resolve to a known code, surface a clear message in the SAP Sync dialog like:

   ```text
   Cannot sync to SAP: vendor state "<value>" is not mapped to an SAP region code.
   Please correct the vendor's Registered State and retry.
   ```

   instead of letting SAP reject it generically.

3. **Redeploy** the `sync-vendor-to-sap` edge function so the new mapping takes effect immediately.

4. **Retry sync** for SHARVI INFOTECH PRIVATE LIMITED. With Telangana now sent as `36`, SAP should accept the Business Partner create call and return a `BP_LIFNR`.

## Files to change

- `supabase/functions/sync-vendor-to-sap/index.ts` — replace the `stateToRegion` map with the numeric T005S codes above and add a normalized lookup + clearer pre-validation error.

## Note on region codes

These are the **standard SAP India T005S codes** that match GSTIN state codes (Telangana = 36, Andhra Pradesh = 37 in GSTIN, but in SAP T005S Telangana is 36 in most India localization configurations). If your specific SAP client uses a customized T005S table and one or two states still fail after this fix, share the SAP error and we'll adjust just those entries — the mapping is now in one place and easy to tweak.
