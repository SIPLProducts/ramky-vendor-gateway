import { CheckCircle2, Mail, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SubmissionSuccessDialogProps {
  open: boolean;
  onClose: () => void;
  inviter?: { name?: string; email?: string } | null;
  notifyFailed?: boolean;
}

export function SubmissionSuccessDialog({
  open,
  onClose,
  inviter,
  notifyFailed,
}: SubmissionSuccessDialogProps) {
  const hasInviter = !!inviter?.email;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            {hasInviter ? (
              <CheckCircle2 className="h-8 w-8 text-primary" />
            ) : (
              <AlertCircle className="h-8 w-8 text-amber-500" />
            )}
          </div>
          <DialogTitle className="text-center text-xl">
            Application Submitted Successfully
          </DialogTitle>
        </DialogHeader>

        <div className="text-center text-sm text-muted-foreground space-y-3 px-2">
          {hasInviter ? (
            <>
              <p>
                Submission details have been sent to the respective buyer who sent the invitation:
              </p>
              <div className="rounded-md border bg-muted/40 p-3 text-foreground">
                <div className="flex items-center justify-center gap-2 font-medium">
                  <Mail className="h-4 w-4 text-primary" />
                  {inviter?.name || inviter?.email}
                </div>
                {inviter?.name && (
                  <div className="text-xs text-muted-foreground mt-1">{inviter.email}</div>
                )}
              </div>
            </>
          ) : (
            <p>
              Your application has been received. {notifyFailed
                ? "The buyer notification could not be sent automatically — our team has been informed."
                : "No invited buyer is linked to this application, so no notification email was sent."}
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-center">
          <Button onClick={onClose} className="min-w-32">Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
