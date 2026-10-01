# Keep failed KYC replacements failed after reopening

## Implementation
- Load the newest GST, PAN, MSME, and Bank validation status and message with the saved vendor.
- When the newest status is Failed/Requires Review, restore that tab as failed with no saved document or details, even if older data remains.
- Keep Continue disabled until that tab is uploaded and verified again.
- Apply the same reload behavior independently to GST, PAN, MSME, and Bank without changing the other tabs.
- Ensure successful re-verification replaces the failed state normally.

## Verification
- Check failed PAN replacement, autosave/manual Save Draft, refresh, browser back/forward, and reopen.
- Confirm the failed message remains, the old and rejected PAN do not return, and MSME Continue stays disabled.
- Confirm unaffected GST, MSME, and Bank data remains unchanged.
