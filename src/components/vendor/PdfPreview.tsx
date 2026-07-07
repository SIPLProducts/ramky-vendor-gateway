import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertCircle } from 'lucide-react';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';


pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfPreviewProps {
  /** Preferred: PDF bytes as a Blob (avoids extra network fetch). */
  blob?: Blob | null;
  /** Fallback URL if no blob is available. */
  url?: string | null;
}

export function PdfPreview({ blob, url }: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [width, setWidth] = useState<number>(800);
  const [error, setError] = useState<string | null>(null);

  // Stable file prop — recreate only when the source changes.
  const file = useMemo(() => {
    if (blob) return blob;
    if (url) return url;
    return null;
  }, [blob, url]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth - 16);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setError(null);
  };

  const onLoadError = (err: Error) => {
    console.error('PDF load error:', err);
    setError(err?.message || 'Failed to render PDF');
  };

  if (!file) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        No PDF to display
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-2 py-2 border-b bg-muted/40 rounded-t">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums px-2">
            {numPages ? `${pageNumber} / ${numPages}` : '…'}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPageNumber((p) => Math.min(numPages || p, p + 1))}
            disabled={!numPages || pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.min(2, +(s + 0.25).toFixed(2)))}
            disabled={scale >= 2}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Viewer */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/20 rounded-b p-2 max-h-[70vh]"
      >
        {error ? (
          <div className="flex flex-col items-center justify-center h-40 text-destructive text-sm gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        ) : (
          <Document
            file={file}
            onLoadSuccess={onLoadSuccess}
            onLoadError={onLoadError}
            loading={
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading PDF…
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              width={Math.max(200, width * scale)}
              renderAnnotationLayer
              renderTextLayer
            />
          </Document>
        )}
      </div>
    </div>
  );
}

export default PdfPreview;
