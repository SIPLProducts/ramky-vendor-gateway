## Remove redundant "My Approvals" screen

The generic **My Approvals** page is no longer needed — its purpose is fully covered by the new stage-specific approval screens (SCM Manager, SCM Head, Finance 1, Finance 2, CEO Office), which each show the approver their pending vendors filtered by stage.

### Changes

1. **Delete files**
   - `src/pages/MyApprovals.tsx`
   - `src/hooks/useMyApprovals.tsx`

2. **`src/App.tsx`**
   - Remove `import MyApprovals` and the `/admin/my-approvals` route.

3. **`src/components/layout/Sidebar.tsx`**
   - Remove the `{ label: 'My Approvals', href: '/admin/my-approvals', ... }` nav entry.

4. **`src/hooks/useScreenPermissions.tsx`**
   - Remove the block that auto-grants the `my_approvals` screen key to anyone listed in `approval_matrix_approvers`. Stage screens have their own permission keys.

5. **`src/hooks/useVendors.tsx`**
   - Remove the leftover `queryClient.invalidateQueries({ queryKey: ['my-approvals'] })` call (dead query key).

6. **Database cleanup (migration)**
   - Delete the `my_approvals` rows from `role_screen_permissions` and `custom_role_screen_permissions` so the key no longer appears anywhere.

### Result

Approvers will use the dedicated stage screens from the sidebar (SCM Manager Approval, SCM Head Approval, Finance 1/2 Approval, CEO Approval). The "My Approvals" entry disappears from the sidebar and the route returns NotFound.