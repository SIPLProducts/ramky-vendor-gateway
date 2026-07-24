import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
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

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const BUCKET = 'vendor-documents';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type DocumentType = typeof DOCUMENT_TYPES[number];
const DOCUMENT_TYPE_SET = new Set<string>(DOCUMENT_TYPES as readonly string[]);

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && DOCUMENT_TYPE_SET.has(value);
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitizeFileName(name: string) {
  return (name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let currentStep = 'init';
  const log = (step: string, extra: Record<string, unknown> = {}) => {
    currentStep = step;
    console.log(JSON.stringify({ fn: 'upload-vendor-document', step, ...extra }));
  };

  try {
    log('auth_start');
    const auth = await requireAuthenticatedUser(req);
    if (!auth.ok) {
      log('auth_failed', { status: auth.status });
      return authErrorResponse(auth, corsHeaders);
    }
    log('auth_ok', { userId: auth.userId });

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      log('invalid_form_data');
      return json(400, { error: 'Upload request must be multipart form data' });
    }
    const vendorIdValue = form.get('vendorId');
    const documentTypeValue = form.get('documentType');

    if (!isUuid(vendorIdValue)) {
      return json(400, { error: 'Invalid upload request', details: { vendorId: ['Valid vendor id is required'] } });
    }
    if (!isDocumentType(documentTypeValue)) {
      return json(400, { error: 'Invalid upload request', details: { documentType: ['Unsupported document type'] } });
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

    const vendorId = vendorIdValue;
    const documentType = documentTypeValue;
    log('request_validated', { vendorId, documentType, fileName: fileValue.name, fileSize: fileValue.size });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      log('missing_backend_env', { hasUrl: Boolean(supabaseUrl), hasServiceKey: Boolean(serviceKey) });
      return json(500, { error: 'Upload service is not configured' });
    }

    const admin = createClient(
      supabaseUrl,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    log('vendor_lookup_start', { vendorId });
    const { data: vendor, error: vendorError } = await admin
      .from('vendors')
      .select('id, user_id, invitation_id')
      .eq('id', vendorId)
      .maybeSingle();

    if (vendorError) {
      log('vendor_lookup_failed', { message: vendorError.message });
      return json(500, { error: 'Could not verify vendor access', details: vendorError.message });
    }
    if (!vendor) {
      log('vendor_not_found', { vendorId });
      return json(404, { error: 'Vendor not found' });
    }

    let allowed = vendor.user_id === auth.userId;
    let allowedBy = allowed ? 'vendor_user_id' : null;

    if (!allowed && vendor.invitation_id) {
      const { data: invite, error: inviteError } = await admin
        .from('vendor_invitations')
        .select('id, created_by, user_id, vendor_id')
        .eq('id', vendor.invitation_id)
        .maybeSingle();
      if (inviteError) {
        log('invitation_lookup_failed', { message: inviteError.message });
        return json(500, { error: 'Could not verify invitation access', details: inviteError.message });
      }
      allowed = invite?.created_by === auth.userId || invite?.user_id === auth.userId;
      if (allowed) allowedBy = invite?.created_by === auth.userId ? 'invitation_created_by' : 'invitation_user_id';
    }

    if (!allowed) {
      const { data: linkedInvites, error: linkedInviteError } = await admin
        .from('vendor_invitations')
        .select('id, created_by, user_id')
        .eq('vendor_id', vendorId);
      if (linkedInviteError) {
        log('linked_invitation_lookup_failed', { message: linkedInviteError.message });
        return json(500, { error: 'Could not verify linked invitation access', details: linkedInviteError.message });
      }
      allowed = (linkedInvites ?? []).some((invite: any) => (
        invite.created_by === auth.userId || invite.user_id === auth.userId
      ));
      if (allowed) allowedBy = 'linked_invitation';
    }

    if (!allowed) {
      log('access_denied', { vendorId, documentType, userId: auth.userId });
      return json(403, { error: 'Upload not allowed for this vendor and current user' });
    }
    log('access_allowed', { vendorId, documentType, allowedBy });

    log('existing_document_lookup_start', { vendorId, documentType });
    const { data: existingDoc } = await admin
      .from('vendor_documents')
      .select('id, file_path')
      .eq('vendor_id', vendorId)
      .eq('document_type', documentType)
      .maybeSingle();

    const safeName = sanitizeFileName(fileValue.name);
    const filePath = `${vendorId}/${documentType}/${Date.now()}_${safeName}`;

    log('storage_upload_start', { bucket: BUCKET, filePath, documentType });
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(filePath, fileValue, {
        upsert: false,
        contentType: fileValue.type || 'application/octet-stream',
      });

    if (uploadError) {
      log('storage_upload_failed', { message: uploadError.message, documentType });
      return json(500, { error: `Failed to upload ${documentType}`, details: uploadError.message });
    }

    log('metadata_upsert_start', { vendorId, documentType });
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
      log('metadata_upsert_failed', { message: metadataError.message, documentType });
      return json(500, { error: `Failed to save document metadata for ${documentType}`, details: metadataError.message });
    }

    const previousPath = existingDoc?.file_path;
    if (previousPath && previousPath !== filePath) {
      log('previous_file_cleanup_start', { previousPath });
      await admin.storage.from(BUCKET).remove([previousPath]);
    }

    log('upload_complete', { vendorId, documentType, filePath });
    return json(200, {
      documentType,
      filePath,
      fileName: fileValue.name,
      fileSize: fileValue.size,
      mimeType: fileValue.type || 'application/octet-stream',
    });
  } catch (err: any) {
    console.error(JSON.stringify({ fn: 'upload-vendor-document', step: currentStep, error: err?.message || String(err) }));
    return json(500, { error: err?.message || 'Unexpected upload error', step: currentStep });
  }
});