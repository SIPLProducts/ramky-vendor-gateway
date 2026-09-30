# Stop Vendor Emails at Registration and SAP Sync

## Goal
Stop only these two vendor-facing emails:
1. The confirmation sent when a vendor submits or resubmits the registration form.
2. The success email sent to the vendor after SAP Sync.

Buyer emails and every other email trigger will remain unchanged.

## Changes
- Update the registration notification so it continues resolving and emailing the inviting buyer, but no longer sends the additional confirmation to the vendor.
- Update the SAP Sync success notification so only the buyer receives it; remove the vendor from the recipient list.
- Keep registration submission/resubmission processing, SAP Sync status updates, email content for buyers, audit history, and failure handling unchanged.
- Adjust SAP Sync audit details so they accurately record only the buyer recipient and do not imply the vendor was notified.

## Verification
- Confirm registration submission still invokes the buyer notification and contains no vendor email send.
- Confirm registration resubmission follows the same buyer-only behavior.
- Confirm successful SAP Sync sends to the buyer only.
- Search all related notification paths to ensure no other email triggers were altered.
- Check the application build and diagnostics after the changes.

## Technical Details
- Modify the existing registration notification function rather than changing the registration form flow.
- Modify the existing single-vendor SAP Sync notification recipient construction; bulk sync currently has no matching vendor-email block to remove.
- No database changes are required.
