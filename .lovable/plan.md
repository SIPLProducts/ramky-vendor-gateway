## Problem

In the Vendor Registration → Organization Profile step, the **State** field auto-populates based on the verified GST data, but sometimes it incorrectly fills as **Telangana** even when the vendor's GST state is different (e.g. Andhra Pradesh).

### Root cause

`src/components/vendor/steps/OrganizationStep.tsx` (lines 170–184) computes a `gstStateHint` from:

1. `statutoryData.gstJurisdictionState` (e.g. `"State - Telangana"`), then falls back to
2. `statutoryData.gstPrincipalPlaceOfBusiness` (the full registered address string).

It then matches with `hint.includes(stateName.toLowerCase())` across `INDIAN_STATES`. Two problems:

- The principal-place fallback is a free-form address; if any line of that address contains the word "Telangana" (e.g. a Hyderabad communication address, or stale data from a previous GST), the substring match wins regardless of the real GST state.
- `Array.find` returns the first state in declaration order whose name appears in the hint. Because "Andhra Pradesh" and "Telangana" can both appear in long jurisdiction strings, the result is non-deterministic.
- Once auto-populated, the value is never re-evaluated when a fresh GST is verified, so the wrong state sticks.

## Fix

Rewrite the auto-population logic in `OrganizationStep.tsx` to use a deterministic source of truth:

1. **Primary source — GSTIN state code.** The first 2 digits of `statutoryData.gstin` are the official state code (per GSTN). Add a `GST_STATE_CODE_MAP` (`"01" → "Jammu and Kashmir"`, `"28" → "Andhra Pradesh"`, `"36" → "Telangana"`, `"37" → "Andhra Pradesh"`, …) and resolve the state directly from `gstin.slice(0, 2)`.
2. **Fallback — exact jurisdiction state.** Only when no GSTIN is present, parse `gstJurisdictionState` by stripping common prefixes/suffixes (`"State - "`, `" State Tax"`) and match against `INDIAN_STATES` with case-insensitive **equality** (no `includes`).
3. **Drop the principal-place fallback entirely** — addresses are not a reliable source for the registered state.
4. **Re-apply when GST changes.** Track the previously auto-set value with a ref. If the user has not manually edited the State field (i.e. the current value equals the last auto-set value, or is empty), update it when the resolved GST state changes. Never overwrite a value the user picked manually.
5. Keep the existing behavior of mirroring State → Vendor Location.

### Files to change

- `src/components/vendor/steps/OrganizationStep.tsx` — replace the `gstStateHint` effect (lines 170–184) with the GSTIN-code-based resolver and the ref-guarded re-apply logic.
- `src/types/vendor.ts` — add and export `GST_STATE_CODE_MAP` next to `INDIAN_STATES` so the same mapping can be reused elsewhere (e.g. Address step) without duplication.

### Out of scope

- No DB schema or edge-function changes; this is a pure client-side fix in the registration form.
- No change to how `gstJurisdictionState` / `gstPrincipalPlaceOfBusiness` are captured during GST verification — only how the Organization step interprets them.
- No change to the manual State dropdown UI.
