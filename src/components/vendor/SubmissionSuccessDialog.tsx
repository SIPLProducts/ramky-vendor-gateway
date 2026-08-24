import { CheckCircle2, Mail, AlertCircle, Phone, User, Hash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface VendorIdentity {
  vendorName?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  contactPerson?: string;
  vendorRef?: string;
}

interface SubmissionSuccessDialogProps {
  open: boolean;
  onClose: () => void;
  inviter?: { name?: string; email?: string } | null;
  status?: "success" | "failure";
  vendorIdentity?: VendorIdentity | null;
  errorMessage?: string | null;
  /** @deprecated use status="failure" */
  notifyFailed?: boolean;
}

export function SubmissionSuccessDialog({
  open,
  onClose,
  inviter,
  status,
  vendorIdentity,
  errorMessage,
  notifyFailed,
}: SubmissionSuccessDialogProps) {
  const resolvedStatus: "success" | "failure" =
    status ?? (notifyFailed ? "failure" : "success");
  const isSuccess = resolvedStatus === "success";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            {isSuccess ? (
              <CheckCircle2 className="h-8 w-8 text-primary" />
            ) : (
              <AlertCircle className="h-8 w-8 text-amber-500" />
            )}
          </div>
          <DialogTitle className="text-center text-xl">
            {isSuccess
              ? "Application Submitted Successfully"
              : "Application Submitted — Notification Failed"}
          </DialogTitle>
        </DialogHeader>

        <div className="text-center text-sm text-muted-foreground space-y-3 px-2">
          {isSuccess ? (
            <>
              <p>
                Your application has been received successfully. An email has been
                sent to the respective buyer and configured email IDs.
              </p>
              <p>Thank you.</p>
            </>
          ) : (
            <>
              <p>
                Your application was saved
                {vendorIdentity?.vendorRef ? ` (Ref ${vendorIdentity.vendorRef})` : ""}
                , but we could not send the confirmation email to the buyer.
                Our team has been notified. Please contact{" "}
                <a
                  href="mailto:vyapaarsupport@ramky.com"
                  className="text-primary underline"
                >
                  vyapaarsupport@ramky.com
                </a>{" "}
                if you do not receive a follow-up.
              </p>
              {errorMessage && (
                <p className="text-xs text-muted-foreground/80 italic">
                  {errorMessage}
                </p>
              )}
            </>
          )}

          {vendorIdentity && (vendorIdentity.vendorEmail || vendorIdentity.vendorPhone || vendorIdentity.vendorName) && (
            <div className="rounded-md border bg-muted/40 p-3 text-left text-foreground text-xs space-y-1.5">
              <div className="text-xs text-muted-foreground font-medium">
                Vendor Details
              </div>
              {vendorIdentity.vendorName && (
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{vendorIdentity.vendorName}</span>
                </div>
              )}
              {vendorIdentity.vendorEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="break-all">{vendorIdentity.vendorEmail}</span>
                </div>
              )}
              {vendorIdentity.vendorPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{vendorIdentity.vendorPhone}</span>
                </div>
              )}
              {vendorIdentity.vendorRef && (
                <div className="flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-mono">{vendorIdentity.vendorRef}</span>
                </div>
              )}
            </div>
          )}

          {isSuccess && inviter?.email && (
            <div className="rounded-md border bg-muted/40 p-3 text-foreground">
              <div className="text-xs text-muted-foreground font-medium mb-1">
                Notification sent to
              </div>
              <div className="flex items-center justify-center gap-2 font-medium text-sm">
                <Mail className="h-4 w-4 text-primary" />
                {inviter?.name || inviter?.email}
              </div>
              {inviter?.name && (
                <div className="text-xs text-muted-foreground mt-1">{inviter.email}</div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-center">
          <Button onClick={onClose} className="min-w-32">Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
