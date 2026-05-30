## Problem

In `RegistrationStatusTracker`, when status is `submitted` / `validation_pending`, `getActiveStepIndex` returns `1` (Document Verification) but step 0 (Submitted) is rendered as "active" with pulse and "In Progress" — because the tracker shows "Submitted – In Progress" while Document Verification looks pending.

Actually the real issue is the opposite: the user expects "Submitted" to always be Completed once the form is submitted, and the active marker to sit on the current real stage:

- `submitted` / `validation_pending` → Submitted=completed, Document Verification=active
- `validation_failed` → Submitted=completed, Document Verification=failed
- `scm_manager_review` → steps 0–1 completed, SCM Manager (2)=active
- `scm_head_review` → 0–2 completed, SCM Head (3)=active
- `finance_1_review` → 0–3 completed, Finance 1 (4)=active
- `finance_2_review` / `ceo_office_review` → 0–4 completed, Finance 2 (5)=active
- `pending_sap_sync` → 0–5 completed, SAP Sync (6)=active
- `sap_synced` → all 7 completed

The current `getActiveStepIndex` values are already correct for stages ≥ 2. The bug is only at the start: the connector progress line uses `activeStepIndex / (steps-1)` so when active=1 the line fills only ~16%, and step 0 ("Submitted") renders as pending grey instead of completed.

## Fix

Edit `src/components/vendor/RegistrationStatusTracker.tsx`:

1. In `getStepStatus`, treat step 0 ("Submitted") as `completed` whenever the vendor status is anything other than `draft` (submission has happened by definition once a status exists).
2. Keep current `activeStepIndex` mapping for `submitted` / `validation_pending` at `1` so Document Verification shows as active (pulsing) and labelled "In Progress", while Submitted shows completed with the check icon.
3. Update the progress connector width so the filled bar reaches the active step's centre. Use `(adjustedActiveIndex / (statusSteps.length - 1)) * 100%` without the `- 40px` subtraction, or compute width per-step so step 1 active visually fills the segment from Submitted → Document Verification. Concretely: render the filled line up to the active step (inclusive of completed steps, half-way through active).
4. For the description line under an active step, keep "In Progress"; for completed steps show the original `step.description` (or "Completed"); failed unchanged.
5. No changes needed to backend status values — current statuses already drive the right step indexes for stages ≥ 2.

## Files

- `src/components/vendor/RegistrationStatusTracker.tsx` — only file touched. Pure presentation fix.

## Out of scope

- No edge-function, DB, or workflow-engine changes. The status values written by `seed_vendor_approval_progress` and `process-approval-action` are already correct; only the visual mapping is wrong.
