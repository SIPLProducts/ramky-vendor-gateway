import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenants } from '@/hooks/useTenant';
import { useTenantContext } from '@/hooks/useTenantContext';
import { useAuth } from '@/hooks/useAuth';
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
  Filter,
  Building2,
  User,
  Phone,
} from 'lucide-react';
import { z } from 'zod';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

const emailSchema = z.string().email('Please enter a valid email address');

export default function AdminInvitations() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [expiryDays, setExpiryDays] = useState('14');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allTenants } = useTenants();
  const { user, userRole } = useAuth();
  const { myTenants, activeTenantId } = useTenantContext();
  const isSuperAdmin = userRole === 'sharvi_admin' || userRole === 'admin';

  // Tenants the user is allowed to invite for:
  // - Super admins: all active tenants
  // - Everyone else: tenants assigned to them via user_tenants
  const allowedTenants = isSuperAdmin ? (allTenants ?? []) : myTenants;

  // Default the dialog selection: prefer header's active tenant if allowed, else first allowed tenant
  const defaultTenantId =
    (activeTenantId && allowedTenants.some((t) => t.id === activeTenantId) ? activeTenantId : null) ||
    allowedTenants[0]?.id ||
    '';

  // Initialize selectedTenantId once allowedTenants resolve
  if (!selectedTenantId && defaultTenantId) {
    // setState during render is safe here because it converges in one extra render
    setSelectedTenantId(defaultTenantId);
  }

  const effectiveTenantId = selectedTenantId || null;

  // Fetch invitations (RLS scopes by tenant for non-super-admins)
  const { data: invitations, isLoading } = useQuery({
    queryKey: ['vendor-invitations', isSuperAdmin ? 'all' : (activeTenantId || 'mine')],
    queryFn: async () => {
      let q = supabase
        .from('vendor_invitations')
        .select('*')
        .order('created_at', { ascending: false });

      // Non-super-admins: client filter by header's active tenant when one is chosen (RLS already enforces)
      if (!isSuperAdmin && activeTenantId) {
        q = q.eq('tenant_id', activeTenantId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Create invitation mutation
  const createInvitation = useMutation<any, Error, { email: string; vendorName: string; phoneNumber: string; expiryDays: number; tenantId: string | null }>({
    mutationFn: async ({ email, vendorName, phoneNumber, expiryDays, tenantId }) => {
      // Generate unique token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      // Get tenant name for email
      const selectedTenant = tenants?.find(t => t.id === tenantId);
      const tenantName = selectedTenant?.name || 'Ramky Infrastructure';

      // Step 1: Create invitation in database
      const { data: invitation, error: dbError } = await supabase
        .from('vendor_invitations')
        .insert({
          email,
          token,
          expires_at: expiresAt.toISOString(),
          tenant_id: tenantId || null,
          vendor_name: vendorName || null,
          phone_number: phoneNumber || null,
        })
        .select('*')
        .single();

      if (dbError) throw dbError;

      // Step 2: Send invitation email immediately
      console.log('Sending invitation email to:', email);
      const { data: emailData, error: emailError } = await supabase.functions.invoke('send-vendor-invitation', {
        body: {
          email: invitation.email,
          token: invitation.token,
          expiresAt: invitation.expires_at,
          invitationId: invitation.id,
          vendorName: vendorName || null,
          tenantId: tenantId || null,
          tenantName: tenantName,
          simulationMode: false,
          frontendUrl: window.location.origin,
          senderEmail: user?.email,
        },
      });

      // Surface "not configured" error from edge function (returns non-2xx with JSON body)
      const notConfiguredMsg = 'You are not configured in Email Configuration';
      let serverErrMsg = '';
      if (emailError) {
        try {
          const ctx: any = (emailError as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            serverErrMsg = body?.error || '';
          } else if (ctx && typeof ctx.text === 'function') {
            const txt = await ctx.text();
            try { serverErrMsg = JSON.parse(txt)?.error || txt; } catch { serverErrMsg = txt; }
          }
        } catch { /* ignore */ }
      }
      const respErrMsg = serverErrMsg || (emailData as any)?.error || (emailError as any)?.message || '';
      if (typeof respErrMsg === 'string' && respErrMsg.includes(notConfiguredMsg)) {
        return { invitation, emailSent: false, notConfigured: true };
      }

      if (emailError) {
        return { invitation, emailSent: false, error: emailError };
      }

      console.log('Email sent successfully:', emailData);
      return { invitation, emailSent: true, emailData };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invitations'] });
      setIsDialogOpen(false);
      setEmail('');
      setVendorName('');
      setPhoneNumber('');
      setExpiryDays('14');
      setSelectedTenantId('');

      if (result.emailSent) {
        toast({
          title: 'Invitation Sent',
          description: `Invitation email has been sent to ${result.invitation.email}`,
        });
      } else if ((result as any).notConfigured) {
        toast({
          title: 'Email Not Configured',
          description: 'You are not configured in Email Configuration',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Invitation Created',
          description: 'Invitation created but email failed to send. You can resend it from the list.',
          variant: 'default',
        });
      }
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

      console.log('Calling edge function for invitation:', invitationId);

      // Get tenant name for email - tenants is an array from the join
      const tenantData = (invitation as any).tenants;
      const tenantName = Array.isArray(tenantData) ? tenantData[0]?.name : tenantData?.name || 'Ramky Infrastructure';

      // Call edge function to send invitation email
      const { data, error } = await supabase.functions.invoke('send-vendor-invitation', {
        body: {
          email: invitation.email,
          token: invitation.token,
          expiresAt: invitation.expires_at,
          invitationId: invitation.id,
          vendorName: (invitation as any).vendor_name || null,
          tenantId: (invitation as any).tenant_id || null,
          tenantName: tenantName,
          simulationMode: false, // Real email sending
          frontendUrl: window.location.origin,
          senderEmail: user?.email,
        },
      });

      const notConfiguredMsg = 'You are not configured in Email Configuration';
      let serverErrMsg = '';
      if (error) {
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            serverErrMsg = body?.error || '';
          } else if (ctx && typeof ctx.text === 'function') {
            const txt = await ctx.text();
            try { serverErrMsg = JSON.parse(txt)?.error || txt; } catch { serverErrMsg = txt; }
          }
        } catch { /* ignore */ }
      }
      const respErrMsg = serverErrMsg || (data as any)?.error || (error as any)?.message || '';
      if (typeof respErrMsg === 'string' && respErrMsg.includes(notConfiguredMsg)) {
        throw new Error(notConfiguredMsg);
      }

      if (error) {
        console.error('Edge function error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw new Error(serverErrMsg || error.message || 'Failed to send email');
      }

      console.log('Edge function response:', data);
      return { invitation, simulated: data?.simulated, emailId: data?.emailId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invitations'] });
      toast({
        title: result?.simulated ? 'Email Simulated' : 'Email Sent',
        description: result?.simulated
          ? 'Invitation email simulated (demo mode). Check console for details.'
          : `Invitation email has been sent to ${result.invitation.email}`,
      });
    },
    onError: (error: any) => {
      console.error('Send email mutation error:', error);
      const isNotConfigured = (error?.message || '').includes('You are not configured in Email Configuration');
      toast({
        title: isNotConfigured ? 'Email Not Configured' : 'Email Failed',
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

    if (!effectiveTenantId) {
      toast({
        title: 'No Company Assigned',
        description: isSharviAdmin
          ? 'Please select a company.'
          : 'Your account is not assigned to any company. Contact your administrator.',
        variant: 'destructive',
      });
      return;
    }

    createInvitation.mutate({ email, vendorName, phoneNumber, expiryDays: parseInt(expiryDays), tenantId: effectiveTenantId });
  };

  const copyInvitationLink = (token: string) => {
    const link = `${window.location.origin}/vendor/invite?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    toast({
      title: 'Link Copied',
      description: 'Invitation link has been copied to clipboard.',
    });
  };

  const getInvitationStatus = (invitation: any): 'used' | 'expired' | 'pending' => {
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    if (invitation.used_at) return 'used';
    if (expiresAt < now) return 'expired';
    return 'pending';
  };

  // Filter invitations
  const filteredInvitations = invitations?.filter((invitation) => {
    const matchesSearch = invitation.email.toLowerCase().includes(searchTerm.toLowerCase());
    const status = getInvitationStatus(invitation);
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  // Pagination
  const totalItems = filteredInvitations.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedInvitations = filteredInvitations.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const getStatusBadge = (invitation: any) => {
    const status = getInvitationStatus(invitation);

    if (status === 'used') {
      return (
        <Badge variant="default" className="bg-success">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Used
        </Badge>
      );
    }

    if (status === 'expired') {
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
                <Label htmlFor="vendor-name">Vendor Name</Label>
                <Input
                  id="vendor-name"
                  type="text"
                  placeholder="John Doe"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                />
              </div>

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
                <Label htmlFor="vendor-phone">Phone Number</Label>
                <Input
                  id="vendor-phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
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

              {isSharviAdmin ? (
                <div className="space-y-2">
                  <Label htmlFor="company">Company (Tenant)</Label>
                  <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                    <SelectTrigger id="company">
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants?.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Company</Label>
                  <div className="text-sm rounded-md border bg-muted/50 px-3 py-2">
                    {tenants?.find(t => t.id === currentUserTenantId)?.name || (currentUserTenantId ? 'Loading…' : 'No company assigned to your account')}
                  </div>
                </div>
              )}
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Invitation History</CardTitle>
              <CardDescription>
                All vendor invitations and their current status
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Input
                  placeholder="Search by email..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInvitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {invitations?.length === 0
                ? 'No invitations yet. Create your first invitation to get started.'
                : 'No invitations match your search criteria.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInvitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          {(invitation as any).vendor_name ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>{(invitation as any).vendor_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>
                          {(invitation as any).phone_number ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>{(invitation as any).phone_number}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(invitation.created_at), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(invitation.expires_at), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!invitation.used_at && new Date(invitation.expires_at) > new Date() && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => sendEmailInvitation.mutate(invitation.id)}
                                disabled={sendEmailInvitation.isPending && sendEmailInvitation.variables === invitation.id}
                                className="gap-1"
                              >
                                {sendEmailInvitation.isPending && sendEmailInvitation.variables === invitation.id ? (
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
              </div>

              <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
