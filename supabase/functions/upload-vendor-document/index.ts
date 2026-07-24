import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { requireAuthenticatedUser, authErrorResponse } from '../_shared/auth.ts';

const DOCUMENT_TYPES = [
  'gst_certificate',
  'gst_self_declaration',
  'pan_card',
  'msme_certificate',
  'msme_self_declaration',
  'cancelled_cheque',
  'cancelled_cheque_2',
  'financial_docs',
  'dealership_certificate',
  'registration_copy',
  'swift_iban_details',
] as const;

const UploadFieldsSchema = z.object({
  vendorId: z.string().uuid(),
  documentType: z.enum(DOCUMENT_TYPES),
});

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const BUCKET = 'vendor-documents';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitizeFileName(name: string) {
  return (name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const form = await req.formData();
    const parsed = UploadFieldsSchema.safeParse({
      vendorId: form.get('vendorId'),
      documentType: form.get('documentType'),
    });

    if (!parsed.success) {
      return json(400, { error: 'Invalid upload request', details: parsed.error.flatten().fieldErrors });
    }

    const fileValue = form.get('file');
    if (!(fileValue instanceof File)) {
      return json(400, { error: 'File is required' });
    }
    if (fileValue.size <= 0) {
      return json(400, { error: 'File is empty' });
    }
    if (fileValue.size > MAX_FILE_BYTES) {
      return json(400, { error: 'File size must be 20MB or less' });
    }

    const { vendorId, documentType } = parsed.data;
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: vendor, error: vendorError } = await admin
      .from('vendors')
      .select('id, user_id, invitation_id')
      .eq('id', vendorId)
      .maybeSingle();

    if (vendorError) {
      return json(500, { error: 'Could not verify vendor access', details: vendorError.message });
    }
    if (!vendor) {
      return json(404, { error: 'Vendor not found' });
    }

    let allowed = vendor.user_id === auth.userId;

    if (!allowed && vendor.invitation_id) {
      const { data: invite } = await admin
        .from('vendor_invitations')
        .select('id, created_by, user_id, vendor_id')
        .eq('id', vendor.invitation_id)
        .maybeSingle();
      allowed = invite?.created_by === auth.userId || invite?.user_id === auth.userId;
    }

    if (!allowed) {
      const { data: linkedInvites } = await admin
        .from('vendor_invitations')
        .select('id, created_by, user_id')
        .eq('vendor_id', vendorId);
      allowed = (linkedInvites ?? []).some((invite: any) => (
        invite.created_by === auth.userId || invite.user_id === auth.userId
      ));
    }

    if (!allowed) {
      return json(403, { error: 'Upload not allowed for this vendor and current user' });
    }

    const { data: existingDoc } = await admin
      .from('vendor_documents')
      .select('id, file_path')
      .eq('vendor_id', vendorId)
      .eq('document_type', documentType)
      .maybeSingle();

    const safeName = sanitizeFileName(fileValue.name);
    const filePath = `${vendorId}/${documentType}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(filePath, fileValue, {
        upsert: false,
        contentType: fileValue.type || 'application/octet-stream',
      });

    if (uploadError) {
      return json(500, { error: `Failed to upload ${documentType}`, details: uploadError.message });
    }

    const { error: metadataError } = await admin
      .from('vendor_documents')
      .upsert(
        {
          vendor_id: vendorId,
          document_type: documentType,
          file_name: fileValue.name,
          file_path: filePath,
          file_size: fileValue.size,
          mime_type: fileValue.type || 'application/octet-stream',
        },
        { onConflict: 'vendor_id,document_type' },
      );

    if (metadataError) {
      await admin.storage.from(BUCKET).remove([filePath]);
      return json(500, { error: `Failed to save document metadata for ${documentType}`, details: metadataError.message });
    }

    const previousPath = existingDoc?.file_path;
    if (previousPath && previousPath !== filePath) {
      await admin.storage.from(BUCKET).remove([previousPath]);
    }

    return json(200, {
      documentType,
      filePath,
      fileName: fileValue.name,
      fileSize: fileValue.size,
      mimeType: fileValue.type || 'application/octet-stream',
    });
  } catch (err: any) {
    return json(500, { error: err?.message || 'Unexpected upload error' });
  }
});