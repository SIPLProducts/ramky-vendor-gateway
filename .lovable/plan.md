# Dashboard approver names: test data versus Production

## Finding
The name lookup works the same way in Production and the test copy. Production shows names, such as "Finance 2 (Jayavardhan Reddy)", because those applications have an inviting buyer and a configured approval flow.

The test-copy rows that show "Not assigned" are sample records with incomplete setup:
- Coastal (20260723001, Buyer), Delta (20260723002, Finance 1) and Everest (SAP Team) have no invitation. That means no inviting buyer exists, so no approver can be matched. Invited By also shows "—".
- 20260728002 shows "Finance 2 (Stage skipped)". Its buyer's flow has Finance 2 set to skip, so this result is correct.
- Everest has no company assigned, so it does not match the SAP Team member's assigned company.

In Production, "SCM CO (Not assigned)" on 20261017001 means that buyer's approval flow has no SCM CO user. You can fix this in Approval Matrix without changing the app.

## Proposed action
- Change no code. The behavior matches the approved routing rules.
- Optional: clean up or complete the test-copy sample records by linking an invitation/buyer and a company, so names appear when testing locally.
- Optional, Production: assign an SCM CO in the Approval Matrix for the buyer of 20261017001.
