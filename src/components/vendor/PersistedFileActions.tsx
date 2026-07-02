import { useState } from 'react';
import { Eye, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PersistedFileActionsProps {
  filePath?: string | null;
  fileName?: string;
  bucket?: string;
  className?: string;
}

/**
 * View / Download buttons for files that are already stored in Supabase
 * Storage (private bucket). Renders nothing when `filePath` is absent.
 * Used by both the DocumentVerificationStep file pill and the generic
 * FileUpload component so persisted documents from a returned/edit flow
 * remain accessible without re-uploading.
 */
export function PersistedFileActions({
  filePath,
  fileName,
  bucket = 'vendor-documents',
  className,
}: PersistedFileActionsProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<'view' | 'download' | null>(null);

  if (!filePath) return null;

  const getSignedUrl = async () => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 300);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message || 'Failed to generate link');
    }
    return data.signedUrl;
  };

  const handleView = async () => {
    if (busy) return;
    setBusy('view');
    try {
      const url = await getSignedUrl();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast({ title: 'Could not open file', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    if (busy) return;
    setBusy('download');
    try {
      const url = await getSignedUrl();
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || filePath.split('/').pop() || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      toast({ title: 'Download failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={handleView}
        disabled={!!busy}
      >
        {busy === 'view' ? (
          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
        ) : (
          <Eye className="h-3.5 w-3.5 mr-1" />
        )}
        View
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={handleDownload}
        disabled={!!busy}
      >
        {busy === 'download' ? (
          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5 mr-1" />
        )}
        Download
      </Button>
    </div>
  );
}

/** True when a File-like value came from the DB (see PersistedDocumentFile in useVendorRegistration). */
export function isPersistedFile(f: unknown): f is File & { filePath?: string; __persistedDocument?: true } {
  return !!f && typeof f === 'object' && (f as any).__persistedDocument === true;
}
