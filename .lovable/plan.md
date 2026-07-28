## Issue

The Approve / Reject dialogs in `StageApprovalView.tsx` keep whatever text was typed the previous time the dialog was opened. `comments` and `rejectedRemarks` are only cleared on successful submit — not when the dialog is closed via Cancel, nor when it is reopened for a different vendor. So the "first time entered" comment keeps showing up.

## Fix

File: `src/components/approvals/StageApprovalView.tsx`

- Add a `useEffect` that resets `comments` to `''` whenever `actionItem` changes (opens for a new vendor or is closed).
- Add a `useEffect` that resets `rejectedRemarks` to `''` whenever `rejectedAction` changes.

No other behavior changes.

## Out of scope
- No changes to how comments are persisted, displayed in history, or sent to edge functions.
