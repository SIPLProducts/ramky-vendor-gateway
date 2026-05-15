## Goal

In the MSME section of `DocumentVerificationStep`, replace the misleading legacy "Name match vs Legal Name: 0%" red strip with the same cross-match success line already used by the Bank tab — i.e. listing every reference the Enterprise Name matched against (GST Legal Name, GST Trade Name, PAN Holder Name, Bank Account Holder Name).

Example desired line under the Enterprise Name field:

> ✓ Enterprise Name matched with GST Trade Name (100% — Strong Match) and PAN Holder Name (67% — Medium Match).

(Mirrors the bank-tab line in screenshot #2.)

## Files touched

**`src/components/vendor/steps/DocumentVerificationStep.tsx`** (only file)

1. **Upload-path verify (≈ line 670–691)** — after the `evaluateCrossNameMatch` call, when `!evalRes.skipped && evalRes.passed`, compute `enterpriseNameMessage = formatCrossMatchSuccess("Enterprise Name", evalRes.matches)` and add it into the returned `apiData` object (alongside `name`, `enterpriseName`, `udyamNumber`).

2. **Manual-verify path (≈ line 1080–1105)** — same: when the cross-match passes, compute `enterpriseNameMessage` and include it in `setMsmeDoc({ ..., apiData: { ..., enterpriseNameMessage } })`.

3. **Enterprise Name field render — both MSME render blocks (≈ line 1971 and ≈ line 2127)** — directly below the `EditableOcrField` for Enterprise Name, render:
   ```tsx
   {msmeDoc.apiData?.enterpriseNameMessage && (
     <p className="mt-1.5 text-xs text-success flex items-start gap-1.5">
       <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
       <span>{msmeDoc.apiData.enterpriseNameMessage}</span>
     </p>
   )}
   ```
   (Identical pattern to the Bank Account Holder Name line at ≈ 2270.)

4. **Legacy strip (≈ line 2185–2190)** — remove the `CrossCheckStrip` that renders `Name match vs Legal Name: ${msmeDoc.nameMatchScore}%`. It's the red 0% banner in screenshot #1 and is fully superseded by the new cross-match line. Keep `nameMatchScore` state (it is still written into `initialData` / passed back upstream) but stop rendering it here.

## Out of scope

- No changes to `nameMatch.ts`, `MsmeKycTab.tsx`, `BankKycTab.tsx`, `PanKycTab.tsx`, or `ComplianceStep.tsx` — those tabs already render the new cross-match line correctly.
- No threshold or formatter changes.
- No edge function or DB changes.
