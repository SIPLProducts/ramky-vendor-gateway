## Change

In `src/pages/AdminInvitations.tsx`, restrict Resend button to non-on-behalf rows so on-behalf rows show only the Resume button:

```ts
const showResend = !isOnBehalf && (status === 'pending' || status === 'used' || status === 'in_progress' || status === 'expired');
```

`canResumeOnBehalf` stays as-is (Resume on any on-behalf In Progress/Used row).

Result:
- On-behalf rows → Resume only
- Direct email rows → Resend Email (or Resend Invitation if expired)

No other changes.
