Remove the "What Happens Next?" card from the vendor post-submission success screen.

## Change
In `src/components/vendor/SuccessScreen.tsx`:
- Delete the "What's Next" block (lines ~198–214) that renders the card with Document Verification / Finance Review / Purchase Approval / SAP Integration.
- Remove the now-unused `nextSteps` array (lines ~120–141) and the unused lucide icon imports (`FileCheck`, `UserCheck`, `Building2`) from line 1.

No other UI or logic changes — status header, reference number, rejection alerts, and contact support block remain intact.