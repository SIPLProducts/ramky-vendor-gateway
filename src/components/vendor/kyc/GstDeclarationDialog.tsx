import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Download } from "lucide-react";
import { FileUpload } from "@/components/vendor/FileUpload";

interface GstDeclarationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFile: File | null;
  onFileChange: (f: File | null) => void;
  onConfirm: () => void;
  vendorId?: string;
}

export function GstDeclarationDialog({
  open,
  onOpenChange,
  currentFile,
  onFileChange,
  onConfirm,
  vendorId,
}: GstDeclarationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            GST Filing Not Available
          </DialogTitle>
          <DialogDescription>
            We could not find a filed GST return for the most recent tax period.
            Please download the self-declaration form, sign it, and upload the signed copy to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              Once the signed declaration is uploaded, you will automatically be moved to the PAN tab.
            </AlertDescription>
          </Alert>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadTemplate("/templates/gst-returns-declaration.docx")}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Declaration Template
          </Button>


          <FileUpload
            label="Signed GST Self-Declaration *"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            documentType="gst_self_declaration"
            onFileSelect={onFileChange}
            currentFile={currentFile}
            vendorId={vendorId}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={!currentFile} onClick={onConfirm}>
            Continue to PAN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
