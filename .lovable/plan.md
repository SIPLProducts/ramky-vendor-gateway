## Goal
On the Vendor Status screen, change the top-left back button from “Back to Vendor Invitations” to “Back to Dashboard” and make it navigate to the dashboard route.

## File
- `src/pages/VendorStatus.tsx`

## Change
- Update the `Button` near the top of the page:
  - Text: “Back to Dashboard”
  - Navigation: `navigate('/dashboard')`
  - Keep the existing `ArrowLeft` icon, `variant="outline"`, and layout styling.

## Verification
- Quick TypeScript check (`bunx tsgo --noEmit`) to confirm no type errors.
- Visual check in the preview that the button label changed and clicks route to the dashboard.