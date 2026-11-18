// When an application is sent back to the vendor, make sure the vendor's
// latest invitation link stays open for at least 14 more days.
// Only moves the expiry forward; never shortens it. Best-effort.
export async function extendVendorInviteExpiry(admin: any, vendorId: string, days = 14): Promise<void> {
  try {
    const target = new Date(Date.now() + days * 86_400_000);
    const { data: invite } = await admin
      .from('vendor_invitations')
      .select('id, expires_at')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!invite) return;
    if (invite.expires_at && new Date(invite.expires_at) >= target) return;
    const { error } = await admin.from('vendor_invitations').update({ expires_at: target.toISOString() }).eq('id', invite.id);
    if (error) console.warn('extendVendorInviteExpiry failed:', error.message);
  } catch (err) {
    console.warn('extendVendorInviteExpiry error:', err);
  }
}
