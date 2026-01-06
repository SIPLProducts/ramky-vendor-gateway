import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface FileUploadProps {
  label: string;
  accept?: string;
  maxSizeMB?: number;
  vendorId?: string;
  documentType: string;
  onFileSelect: (file: File | null) => void;
  currentFile?: File | null;
  required?: boolean;
}

export function FileUpload({
  label,
  accept = '.pdf,.jpg,.jpeg,.png',
  maxSizeMB = 5,
  vendorId,
  documentType,
  onFileSelect,
  currentFile,
  required = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploaded, setIsUploaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateFile = (file: File): string | null => {
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      return `File size must be less than ${maxSizeMB}MB`;
    }

    const allowedTypes = accept.split(',').map((t) => t.trim().toLowerCase());
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      return `File type not allowed. Accepted: ${accept}`;
    }

    return null;
  };

  const uploadToStorage = async (file: File) => {
    if (!vendorId) {
      // If no vendorId, just store locally for now
      onFileSelect(file);
      setIsUploaded(true);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${vendorId}/${documentType}_${Date.now()}.${fileExt}`;

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const { error } = await supabase.storage
        .from('vendor-documents')
        .upload(fileName, file, { upsert: true });

      clearInterval(progressInterval);

      if (error) throw error;

      setUploadProgress(100);
      setIsUploaded(true);
      onFileSelect(file);
    } catch (error: any) {
      setUploadError(error.message || 'Failed to upload file');
      onFileSelect(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      setUploadError(error);
      return;
    }

    setUploadError(null);
    await uploadToStorage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileChange(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFileChange(file || null);
  };

  const handleRemove = () => {
    setIsUploaded(false);
    setUploadProgress(0);
    setUploadError(null);
    onFileSelect(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>

      {currentFile || isUploaded ? (
        <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {currentFile?.name || 'File uploaded'}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentFile ? `${(currentFile.size / 1024).toFixed(1)} KB` : 'Ready'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="text-destructive hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          )}
        >
          {isUploading ? (
            <div className="w-full space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Upload className="h-5 w-5 text-primary animate-pulse" />
                <span className="text-sm text-muted-foreground">Uploading...</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          ) : (
            <>
              <FileText className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-foreground font-medium">
                Drop file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {accept.replace(/\./g, '').toUpperCase()} up to {maxSizeMB}MB
              </p>
            </>
          )}
        </div>
      )}

      {uploadError && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {uploadError}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
