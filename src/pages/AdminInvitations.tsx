import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Mail,
  Plus,
  Copy,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  RefreshCw,
} from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');

export default function AdminInvitations() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [expiryDays, setExpiryDays] = useState('14');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch invitations
  const { data: invitations, isLoading } = useQuery({
    queryKey: ['vendor-invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Create invitation mutation
  const createInvitation = useMutation({
    mutationFn: async ({ email, expiryDays }: { email: string; expiryDays: number }) => {
      // Generate unique token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      const { data, error } = await supabase
        .from('vendor_invitations')
        .insert({
          email,
          token,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invitations'] });
      setIsDialogOpen(false);
      setEmail('');
      setExpiryDays('14');
      toast({
        title: 'Invitation Created',
        description: 'Vendor invitation has been created successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create invitation',
        variant: 'destructive',
      });
    },
  });

  // Send email mutation (uses simulation mode if RESEND_API_KEY not configured)
  const sendEmailInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const invitation = invitations?.find((inv) => inv.id === invitationId);
      if (!invitation) throw new Error('Invitation not found');

      // Call edge function to send email with simulation mode enabled for demo
      const { data, error } = await supabase.functions.invoke('send-vendor-invitation', {
        body: {
          email: invitation.email,
          token: invitation.token,
          expiresAt: invitation.expires_at,
          simulationMode: true, // Enable simulation mode for demo
        },
      });

      if (error) throw error;
      return { invitation, simulated: data?.simulated };
    },
    onSuccess: (result) => {
      toast({
        title: result?.simulated ? 'Email Simulated' : 'Email Sent',
        description: result?.simulated 
          ? 'Invitation email simulated (demo mode). Check console for details.'
          : 'Invitation email has been sent to the vendor.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Email Failed',
        description: error.message || 'Failed to send invitation email. You can still copy the link.',
        variant: 'destructive',
      });
    },
  });

  const handleCreateInvitation = () => {
    setEmailError(null);

    try {
      emailSchema.parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setEmailError(err.errors[0].message);
        return;
      }
    }

    createInvitation.mutate({ email, expiryDays: parseInt(expiryDays) });
  };

  const copyInvitationLink = (token: string) => {
    const link = `${window.location.origin}/vendor/register?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    toast({
      title: 'Link Copied',
      description: 'Invitation link has been copied to clipboard.',
    });
  };

  const getStatusBadge = (invitation: any) => {
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);

    if (invitation.used_at) {
      return (
        <Badge variant="default" className="bg-success">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Used
        </Badge>
      );
    }

    if (expiresAt < now) {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendor Invitations</h1>
          <p className="text-muted-foreground">
            Send registration links to vendors with custom expiry periods
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Invitation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Vendor Invitation</DialogTitle>
              <DialogDescription>
                Send a registration link to a new vendor. They will use this link to create
                their account and submit their details.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="vendor-email">Vendor Email</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  placeholder="vendor@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(null);
                  }}
                />
                {emailError && (
                  <p className="text-sm text-destructive">{emailError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry-days">Link Validity</Label>
                <Select value={expiryDays} onValueChange={setExpiryDays}>
                  <SelectTrigger id="expiry-days">
                    <SelectValue placeholder="Select validity period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="14">14 Days</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="60">60 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateInvitation}
                disabled={createInvitation.isPending}
                className="gap-2"
              >
                {createInvitation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Create Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invitation History</CardTitle>
          <CardDescription>
            All vendor invitations and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !invitations?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No invitations yet. Create your first invitation to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>{getStatusBadge(invitation)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(invitation.created_at), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(invitation.expires_at), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInvitationLink(invitation.token)}
                          className="gap-1"
                        >
                          {copiedToken === invitation.token ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-success" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy Link
                            </>
                          )}
                        </Button>
                        {!invitation.used_at && new Date(invitation.expires_at) > new Date() && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => sendEmailInvitation.mutate(invitation.id)}
                            disabled={sendEmailInvitation.isPending}
                            className="gap-1"
                          >
                            {sendEmailInvitation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="h-4 w-4" />
                                Send Email
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
