## Goal

1. Add **GST Trade Name** as an extra cross-reference for MSME, Bank, and PAN tabs.
2. Success/failure banners must clearly name **which** field(s) matched, e.g.:
   - `Enterprise Name matched with GST Legal Name (85% — Strong) and PAN Holder Name (78% — Strong).`
   - `Enterprise Name matched with GST Trade Name (62% — Medium).`
   - `Account Holder Name matched with GST Legal Name (90% — Strong), GST Trade Name (88% — Strong), PAN Holder Name (80% — Strong) and MSME Enterprise Name (75% — Strong).`
   - On failure: `Enterprise Name does not match any of the verified names (best 12% with GST Legal Name). Minimum required is 20%.`

References used per tab:

| Candidate | References |
|---|---|
| MSME Enterprise Name | GST Legal Name, GST Trade Name, PAN Holder Name, Bank Account Holder Name |
| Bank Account Holder Name | GST Legal Name, GST Trade Name, PAN Holder Name, MSME Enterprise Name |
| PAN Holder Name | GST Legal Name, GST Trade Name |

Same 20% gate / Low–Medium–Strong tiers — no threshold or formatter signature changes.

## Files touched

1. **`src/components/vendor/steps/ComplianceStep.tsx`**
   - Add `const [gstTradeName, setGstTradeName] = useState<string|undefined>()`.
   - In `handleGstVerified`: capture trade name separately —
     `const tradeFromGst = pickStr(d.trade_name || d.business_name).trim(); if (tradeFromGst) setGstTradeName(tradeFromGst);`
     Keep `gstLegalName` strictly from `d.legal_name` (drop the trade_name fallback so the two stay distinct).
   - Pass `gstTradeName={gstTradeName}` into `PanKycTab`, `MsmeKycTab`, `BankKycTab`.

2. **`src/components/vendor/kyc/MsmeKycTab.tsx`**
   - Add `gstTradeName?: string` prop.
   - In `checkEnterpriseName`, insert `{ field: 'GST Trade Name', value: props.gstTradeName }` into the references list (right after GST Legal Name).
   - No formatter changes — `formatCrossMatchSuccess` / `formatCrossMatchFailure` already list every passing field.

3. **`src/components/vendor/kyc/BankKycTab.tsx`**
   - Add `gstTradeName?: string` prop.
   - Insert `{ field: 'GST Trade Name', value: props.gstTradeName }` into the references list.

4. **`src/components/vendor/kyc/PanKycTab.tsx`**
   - Add `gstTradeName?: string` prop and reference entry.

5. **`src/components/vendor/steps/DocumentVerificationStep.tsx`** (parallel KYC implementation already on the cross-match policy)
   - In all four `evaluateCrossNameMatch` blocks (MSME upload ~line 665, Bank cheque ~line 770, MSME manual ~line 1075, Bank manual ~line 1240), add
     `{ field: 'GST Trade Name', value: gstDoc.ocrData?.trade_name || gstDoc.ocrData?.business_name }`
     next to the existing GST Legal Name reference.

## Out of scope

- No changes to `src/lib/nameMatch.ts` (the helper already lists all matching fields by name in its success message — exactly what the user asked for).
- No threshold / tier changes.
- No edge function or DB changes.
- No restyling of the success/failure banners.
