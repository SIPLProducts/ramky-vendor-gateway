import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Eye, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusOptions = [
  { value: 'submitted', label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  { value: 'validation_pending', label: 'Validation Pending', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'validation_failed', label: 'Validation Failed', color: 'bg-red-100 text-red-700' },
  { value: 'finance_review', label: 'Finance Review', color: 'bg-purple-100 text-purple-700' },
  { value: 'finance_approved', label: 'Finance Approved', color: 'bg-green-100 text-green-700' },
  { value: 'finance_rejected', label: 'Finance Rejected', color: 'bg-red-100 text-red-700' },
  { value: 'purchase_review', label: 'Purchase Review', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'purchase_approved', label: 'Purchase Approved', color: 'bg-green-100 text-green-700' },
  { value: 'purchase_rejected', label: 'Purchase Rejected', color: 'bg-red-100 text-red-700' },
  { value: 'sap_synced', label: 'SAP Synced', color: 'bg-emerald-100 text-emerald-700' },
];

export function EmailNotificationDemo() {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [emailHtml, setEmailHtml] = useState('');
  const [formData, setFormData] = useState({
    vendorEmail: 'vendor@example.com',
    vendorName: 'ABC Infrastructure Pvt Ltd',
    newStatus: 'submitted',
    previousStatus: 'draft',
    comments: '',
  });

  const handleSendNotification = async () => {
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-status-notification', {
        body: {
          vendorId: 'demo-vendor-123',
          ...formData,
          simulationMode: true,
        },
      });

      if (error) throw error;

      if (data.emailPreview?.htmlPreview) {
        setEmailHtml(data.emailPreview.htmlPreview);
      }

      toast({
        title: "Email Simulated",
        description: `Notification for "${statusOptions.find(s => s.value === formData.newStatus)?.label}" would be sent to ${formData.vendorEmail}`,
      });
    } catch (error) {
      console.error('Email notification error:', error);
      toast({
        title: "Error",
        description: "Failed to simulate email notification",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const selectedStatus = statusOptions.find(s => s.value === formData.newStatus);

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notification Demo
          </CardTitle>
          <CardDescription>
            Simulate vendor status change email notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendorEmail">Vendor Email</Label>
              <Input
                id="vendorEmail"
                type="email"
                value={formData.vendorEmail}
                onChange={(e) => setFormData({ ...formData, vendorEmail: e.target.value })}
                placeholder="vendor@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendorName">Vendor Name</Label>
              <Input
                id="vendorName"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                placeholder="Enter vendor name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="previousStatus">Previous Status</Label>
              <Select
                value={formData.previousStatus}
                onValueChange={(value) => setFormData({ ...formData, previousStatus: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select previous status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newStatus">New Status</Label>
              <Select
                value={formData.newStatus}
                onValueChange={(value) => setFormData({ ...formData, newStatus: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <Badge className={status.color}>{status.label}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comments">Reviewer Comments (Optional)</Label>
            <Textarea
              id="comments"
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              placeholder="Add any comments to include in the email..."
              rows={3}
            />
          </div>

          {/* Status Preview */}
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-muted-foreground">Status Change:</span>
              <Badge variant="outline">{formData.previousStatus}</Badge>
              <span className="text-muted-foreground">→</span>
              {selectedStatus && (
                <Badge className={selectedStatus.color}>{selectedStatus.label}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Email will be sent to: <strong>{formData.vendorEmail}</strong>
            </p>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handleSendNotification} 
              disabled={isSending}
              className="flex-1"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Simulate Send Email
                </>
              )}
            </Button>
            {emailHtml && (
              <Button 
                variant="outline"
                onClick={() => setShowPreview(true)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview Email
              </Button>
            )}
          </div>

          {/* Success indicator */}
          {emailHtml && !isSending && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
              <span>Email simulated successfully! Click "Preview Email" to view the generated email.</span>
            </div>
          )}

          {/* Demo Instructions */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <h5 className="font-medium mb-2">Demo Features</h5>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Simulation mode - no actual emails are sent</li>
              <li>Professional HTML email templates for each status</li>
              <li>Reviewer comments included in rejection emails</li>
              <li>Email events logged to audit trail</li>
              <li>Ready for Resend API integration in production</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Email Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              This is how the email would appear to the vendor
            </DialogDescription>
          </DialogHeader>
          <div 
            className="border rounded-lg overflow-hidden"
            dangerouslySetInnerHTML={{ __html: emailHtml }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
