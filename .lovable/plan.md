## Change

The verified inputs already show a green `BadgeCheck` tick inside the input (right adornment). The message below the input (e.g. "PAN is verified", "Legal Name is verified", "IFSC is verified") currently repeats a small `CheckCircle2` tick before the text, which is redundant.

## Edit

**File:** `src/components/vendor/steps/DocumentVerificationStep.tsx` (around lines 3864–3869)

Remove the leading `CheckCircle2` icon from the verified-message line, keeping just the green text label.

Before:
```tsx
{matchesApi && verifiedLabel && (
  <p className="mt-1 flex items-center gap-1 text-[11px] text-success">
    <CheckCircle2 className="h-3 w-3" />
    <span>{verifiedLabel}</span>
  </p>
)}
```

After:
```tsx
{matchesApi && verifiedLabel && (
  <p className="mt-1 text-[11px] text-success">
    <span>{verifiedLabel}</span>
  </p>
)}
```

This covers every field using `EditableOcrField` (PAN, DOB, Legal Name, Trade Name, GSTIN, Udyam Number, Account Number, IFSC, Bank Name, Branch, etc.), so the tick disappears from all "…is verified" messages while the in-input tick remains.

No other logic or styling changes.
