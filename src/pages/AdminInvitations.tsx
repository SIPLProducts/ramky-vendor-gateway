import { useState } from 'react';
import { TenantCombobox } from '@/components/admin/TenantCombobox';
import { useNavigate } from 'react-router-dom';
import { safeUUID } from '@/lib/uuid';
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
import { formatDate } from '@/lib/dateFormat';
import { toProperCase } from '@/lib/textCase';
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
  UserPlus,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { DataTablePagination } from '@/components/ui/data-table-pagination';



const emailSchema = z.string().email('Please enter a valid email address');

export default function AdminInvitations() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateVendorOpen, setIsCreateVendorOpen] = useState(false);
  const [cvEmail, setCvEmail] = useState('');
  const [cvVendorName, setCvVendorName] = useState('');
  const [cvPhone, setCvPhone] = useState('');
  const [cvEmailError, setCvEmailError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [expiryDays, setExpiryDays] = useState('14');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isCheckingReadiness, setIsCheckingReadiness] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allTenants } = useTenants();
  const { user, userRole } = useAuth();
  const {
    myTenants, activeTenantId, setActiveTenantId,
    isSuperAdmin: isSuperAdminCtx, isCrossTenantReviewer,
    isStageApprover, isScmManager, isBuyerRole,
  } = useTenantContext();
  const isSuperAdmin = userRole === 'sharvi_admin' || userRole === 'admin' || isSuperAdminCtx;

  // Tenants the user is allowed to invite for:
  // - Super admins: all active tenants
  // - Everyone else: tenants assigned to them via user_tenants
  const allowedTenants = isSuperAdmin ? (allTenants ?? []) : myTenants;

  // Dialog-local tenant selection. Defaults to the header's active tenant when
  // one is set, otherwise the first allowed tenant. Does NOT mutate the
  // global tenant context — header keeps "All Tenants" if the user chose it.
  const [dialogTenantId, setDialogTenantId] = useState<string>('');
  const selectedTenantId =
    dialogTenantId ||
    (activeTenantId && allowedTenants.some((t) => t.id === activeTenantId) ? activeTenantId : '') ||
    allowedTenants[0]?.id ||
    '';

  const effectiveTenantId = selectedTenantId || null;
  const seesAllInvitations = isSuperAdmin || isCrossTenantReviewer;

  // Fetch invitations with role-scoped visibility.
  // - Admin / SAP Team: all (optionally filtered by active tenant).
  // - Buyer: only invitations they created.
  // - Stage approver / SCM CO: invitations created by buyers configured under them.
  const { data: invitations, isLoading } = useQuery({
    queryKey: [
      'vendor-invitations',
      seesAllInvitations ? 'all' : 'scoped',
      user?.id,
      activeTenantId,
      isStageApprover, isScmManager, isBuyerRole,
    ],
    queryFn: async () => {
      if (!user?.id) return [];

      const attachVendors = async (rows: any[]) => {
        const ids = Array.from(new Set(rows.map((r: any) => r.vendor_id).filter(Boolean)));
        let vMap = new Map<string, any>();
        if (ids.length) {
          const { data: vRows } = await supabase
            .from('vendors')
            .select('id, reference_number, status')
            .in('id', ids);
          vMap = new Map((vRows ?? []).map((v: any) => [v.id, v]));
        }
        rows.forEach((r: any) => { r.vendor = r.vendor_id ? (vMap.get(r.vendor_id) ?? null) : null; });
        return rows;
      };

      if (seesAllInvitations) {
        let q = supabase
          .from('vendor_invitations')
          .select('*, tenants(id, name)')
          .order('created_at', { ascending: false });
        if (activeTenantId) q = q.eq('tenant_id', activeTenantId);
        const { data, error } = await q;
        if (error) throw error;
        return await attachVendors(data ?? []);
      }

      const creatorIds = new Set<string>();
      if (isBuyerRole) creatorIds.add(user.id);

      if (isStageApprover) {
        const { data: flows } = await supabase
          .from('buyer_approval_flows')
          .select('buyer_user_id')
          .or(
            [
              `scm_head_user_id.eq.${user.id}`,
              `finance_1_user_id.eq.${user.id}`,
              `finance_2_user_id.eq.${user.id}`,
              `ceo_office_user_id.eq.${user.id}`,
              `scm_manager_user_id.eq.${user.id}`,
            ].join(','),
          );
        (flows ?? []).forEach((f: any) => f.buyer_user_id && creatorIds.add(f.buyer_user_id));
      }

      if (isScmManager) {
        const { data: maps } = await supabase
          .from('buyer_scm_mappings')
          .select('buyer_user_id')
          .eq('scm_manager_user_id', user.id);
        (maps ?? []).forEach((m: any) => m.buyer_user_id && creatorIds.add(m.buyer_user_id));
      }

      if (creatorIds.size === 0) return [];

      let q = supabase
        .from('vendor_invitations')
        .select('*, tenants(id, name)')
        .in('created_by', Array.from(creatorIds))
        .order('created_at', { ascending: false });
      if (activeTenantId) q = q.eq('tenant_id', activeTenantId);

      const { data, error } = await q;
      if (error) throw error;
      return await attachVendors(data ?? []);
    },
    enabled: !!user?.id,
  });





  // Create invitation mutation
  const createInvitation = useMutation<any, Error, { email: string; vendorName: string; phoneNumber: string; expiryDays: number; tenantId: string | null }>({
    mutationFn: async ({ email, vendorName, phoneNumber, expiryDays, tenantId }) => {
      // Pre-validate via SECURITY DEFINER RPC (bypasses RLS, returns boolean only)
      if (!user?.id) {
        throw new Error('Your session is still loading. Please reload the page and try again.');
      }
      if (!user?.email) {
        throw new Error('You are not configured in Email Configuration');
      }
      const { data: isConfigured, error: cfgErr } = await supabase.rpc('check_my_smtp_configured');
      if (cfgErr) throw cfgErr;
      if (!isConfigured) {
        throw new Error('You are not configured in Email Configuration');
      }

      // Generate unique token
      const token = safeUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      // Get tenant name for email
      const selectedTenant = allowedTenants.find(t => t.id === tenantId) || allTenants?.find(t => t.id === tenantId);
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
          created_by: user?.id ?? null,
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

      // Surface error from edge function (function now always returns 200 with { success, error })
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
      const dataObj: any = emailData ?? {};
      const respErrMsg = serverErrMsg || dataObj?.error || (emailError as any)?.message || '';
      if (typeof respErrMsg === 'string' && respErrMsg.includes(notConfiguredMsg)) {
        return { invitation, emailSent: false, notConfigured: true };
      }

      if (emailError || dataObj?.success === false || respErrMsg) {
        return { invitation, emailSent: false, error: respErrMsg || 'Failed to send email' };
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
          title: 'Email Failed',
          description: (result as any).error
            ? `Invitation created but email failed: ${(result as any).error}`
            : 'Invitation created but email failed to send. You can resend it from the list.',
          variant: 'destructive',
        });
      }

    },
    onError: (error: any) => {
      const msg = error?.message || 'Failed to create invitation';
      const isNotConfigured = msg.includes('You are not configured in Email Configuration');
      toast({
        title: isNotConfigured ? 'Email Not Configured' : 'Error',
        description: msg,
        variant: 'destructive',
      });
    },
  });

  // Create Vendor (on behalf) — creates an on-behalf invitation row WITHOUT sending
  // an email, then navigates the buyer into the registration form. The form will
  // run through the same validations and approval workflow on submit; the BUYER
  // stage is auto-approved server-side because the buyer is the submitter.
  const createVendorOnBehalf = useMutation<any, Error, { email: string; vendorName: string; phoneNumber: string; tenantId: string | null }>({
    mutationFn: async ({ email, vendorName, phoneNumber, tenantId }) => {
      if (!user?.id) throw new Error('Your session is still loading. Please reload and try again.');
      if (!tenantId) throw new Error('Please select a company.');
      const token = safeUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 60);
      const { data: invitation, error } = await supabase
        .from('vendor_invitations')
        .insert({
          email,
          token,
          expires_at: expiresAt.toISOString(),
          tenant_id: tenantId,
          vendor_name: vendorName || null,
          phone_number: phoneNumber || null,
          created_by: user.id,
          created_on_behalf: true,
        })
        .select('*')
        .single();
      if (error) throw error;
      return invitation;
    },
    onSuccess: (invitation) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invitations'] });
      setIsCreateVendorOpen(false);
      setCvEmail('');
      setCvVendorName('');
      setCvPhone('');
      navigate(`/vendor/registration?onBehalfOf=${invitation.id}`);
    },
    onError: (err: any) => {
      toast({
        title: 'Could not start on-behalf registration',
        description: err?.message || 'Failed to create on-behalf invitation',
        variant: 'destructive',
      });
    },
  });

  const handleCreateVendorOnBehalf = () => {
    setCvEmailError(null);
    try { emailSchema.parse(cvEmail); } catch (err) {
      if (err instanceof z.ZodError) { setCvEmailError(err.errors[0].message); return; }
    }
    if (!effectiveTenantId) {
      toast({ title: 'No Company Assigned', description: 'Please select a company.', variant: 'destructive' });
      return;
    }
    createVendorOnBehalf.mutate({ email: cvEmail, vendorName: cvVendorName, phoneNumber: cvPhone, tenantId: effectiveTenantId });
  };



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
      const dataObj: any = data ?? {};
      const respErrMsg = serverErrMsg || dataObj?.error || (error as any)?.message || '';
      if (typeof respErrMsg === 'string' && respErrMsg.includes(notConfiguredMsg)) {
        throw new Error(notConfiguredMsg);
      }

      if (error || dataObj?.success === false || (respErrMsg && !dataObj?.messageId && !dataObj?.simulated)) {
        console.error('Edge function error:', error || respErrMsg);
        throw new Error(respErrMsg || 'Failed to send email');
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

  const checkTenantOnboardingReadiness = async (
    buyerUserId: string,
  ): Promise<{ ok: boolean }> => {
    const { data, error } = await supabase
      .from('buyer_approval_flows')
      .select('id, scm_manager_user_id, scm_head_user_id, finance_1_user_id, finance_2_user_id, ceo_office_user_id, skip_scm_manager, skip_scm_head, skip_finance_1, skip_finance_2')
      .eq('buyer_user_id', buyerUserId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false };
    const hasAnyApprover =
      (!!data.scm_manager_user_id && !data.skip_scm_manager) ||
      (!!data.scm_head_user_id && !data.skip_scm_head) ||
      (!!data.finance_1_user_id && !data.skip_finance_1) ||
      (!!data.finance_2_user_id && !data.skip_finance_2) ||
      !!data.ceo_office_user_id;
    return { ok: hasAnyApprover };
  };

  const tenantNameFor = (tenantId: string) =>
    allowedTenants.find((t) => t.id === tenantId)?.name ||
    allTenants?.find((t) => t.id === tenantId)?.name ||
    'the selected company';

  const showReadinessToast = () => {
    toast({
      title: 'Approval Flow Not Configured',
      description: 'Your Approval Flow is not set up. Ask an admin to configure it under User Management → Approval Matrix before inviting vendors.',
      variant: 'destructive',
    });
  };

  const handleCreateVendorClick = async () => {
    if (!effectiveTenantId) {
      toast({
        title: 'No Company Assigned',
        description: allowedTenants.length > 0
          ? 'Please select a company.'
          : 'Your account is not assigned to any company. Contact your administrator.',
        variant: 'destructive',
      });
      return;
    }
    if (!user?.id) {
      toast({ title: 'Session loading', description: 'Please reload and try again.', variant: 'destructive' });
      return;
    }
    setIsCheckingReadiness(true);
    try {
      const result = await checkTenantOnboardingReadiness(user.id);
      if (!result.ok) {
        showReadinessToast();
        return;
      }
      navigate('/vendor/registration?onBehalf=1');
    } catch {
      toast({
        title: 'Verification Failed',
        description: 'Could not verify tenant configuration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCheckingReadiness(false);
    }
  };

  const handleCreateInvitation = async () => {
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
        description: allowedTenants.length > 0
          ? 'Please select a company.'
          : 'Your account is not assigned to any company. Contact your administrator.',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id) {
      toast({ title: 'Session loading', description: 'Please reload and try again.', variant: 'destructive' });
      return;
    }

    setIsCheckingReadiness(true);
    try {
      const result = await checkTenantOnboardingReadiness(user.id);
      if (!result.ok) {
        showReadinessToast();
        return;
      }
    } catch {
      toast({
        title: 'Verification Failed',
        description: 'Could not verify tenant configuration. Please try again.',
        variant: 'destructive',
      });
      return;
    } finally {
      setIsCheckingReadiness(false);
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

  type InviteStatus = 'pending' | 'used' | 'in_progress' | 'expired' | 'submitted';
  const getInvitationStatus = (invitation: any): InviteStatus => {
    const vStatus = invitation?.vendor?.status as string | undefined;
    if (vStatus && vStatus !== 'draft') return 'submitted';
    if (vStatus === 'draft' || invitation.created_on_behalf) return 'in_progress';
    if (invitation.used_at) return 'used';
    if (new Date(invitation.expires_at) < new Date()) return 'expired';
    return 'pending';
  };

  // Filter invitations
  const filteredInvitations = invitations?.filter((invitation: any) => {
    const status = getInvitationStatus(invitation);
    // Submitted vendors move to Dashboard / All Vendors / Approval screens
    if (status === 'submitted') return false;

    const matchesSearch =
      invitation.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invitation.vendor?.reference_number ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invitation.vendor_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invitation.phone_number ?? '').toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = status === statusFilter;
    }

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
        <Badge variant="default" className="bg-blue-600 hover:bg-blue-600 text-white">
          <Mail className="h-3 w-3 mr-1" />
          Used
        </Badge>
      );
    }

    if (status === 'in_progress') {
      return (
        <Badge variant="default" className="bg-amber-500 hover:bg-amber-500 text-white">
          <Clock className="h-3 w-3 mr-1" />
          In Progress
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

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleCreateVendorClick}
            disabled={isCheckingReadiness}
          >
            <UserPlus className="h-4 w-4" />
            Create Vendor
          </Button>

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
                Send a registration link to a new vendor.
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
                <Label htmlFor="vendor-phone">Contact Number</Label>
                <Input
                  id="vendor-phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="\d{10}"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
                {phoneNumber.length > 0 && phoneNumber.length !== 10 && (
                  <p className="text-xs text-destructive">Enter a 10-digit mobile number</p>
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

              {allowedTenants.length > 1 ? (
                <div className="space-y-2">
                  <Label htmlFor="company">Company {isSuperAdmin ? '(Tenant)' : ''}</Label>
                  <TenantCombobox
                    tenants={allowedTenants}
                    value={selectedTenantId || null}
                    onChange={(id) => setDialogTenantId(id ?? '')}
                    placeholder="Select a company"
                    className="w-full"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Company</Label>
                  <div className="text-sm rounded-md border bg-muted/50 px-3 py-2">
                    {allowedTenants[0]?.name || 'No company assigned to your account'}
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
                disabled={createInvitation.isPending || isCheckingReadiness || (phoneNumber.length > 0 && phoneNumber.length !== 10)}
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

        {/* Create Vendor on behalf dialog */}
        <Dialog open={isCreateVendorOpen} onOpenChange={setIsCreateVendorOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Vendor on Behalf of Vendor</DialogTitle>
              <DialogDescription>
                Open the Vendor Registration form yourself and submit it on behalf of the vendor.
                No email is sent. The submission runs the same validations and approval workflow.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cv-name">Vendor Name</Label>
                <Input
                  id="cv-name"
                  type="text"
                  placeholder="ACME Pvt Ltd"
                  value={cvVendorName}
                  onChange={(e) => setCvVendorName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cv-email">Vendor Email</Label>
                <Input
                  id="cv-email"
                  type="email"
                  placeholder="vendor@company.com"
                  value={cvEmail}
                  onChange={(e) => { setCvEmail(e.target.value); setCvEmailError(null); }}
                />
                {cvEmailError && <p className="text-sm text-destructive">{cvEmailError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cv-phone">Phone Number</Label>
                <Input
                  id="cv-phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={cvPhone}
                  onChange={(e) => setCvPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </div>
              {allowedTenants.length > 1 ? (
                <div className="space-y-2">
                  <Label htmlFor="cv-company">Company</Label>
                  <TenantCombobox
                    tenants={allowedTenants}
                    value={selectedTenantId || null}
                    onChange={(id) => setDialogTenantId(id ?? '')}
                    placeholder="Select a company"
                    className="w-full"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Company</Label>
                  <div className="text-sm rounded-md border bg-muted/50 px-3 py-2">
                    {allowedTenants[0]?.name || 'No company assigned to your account'}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateVendorOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreateVendorOnBehalf}
                disabled={createVendorOnBehalf.isPending || (cvPhone.length > 0 && cvPhone.length !== 10)}
                className="gap-2"
              >
                {createVendorOnBehalf.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Opening…</>
                ) : (
                  <><UserPlus className="h-4 w-4" />Continue to Form</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
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
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Input
                  placeholder="Search by Name, Email or Mobile"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-56">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
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
                      <TableHead>Buyer Company</TableHead>
                      <TableHead>Vendor Name</TableHead>
                      <TableHead>Vendor Email</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInvitations.map((invitation) => {
                      const isOnBehalf = !!(invitation as any).created_on_behalf;
                      const status = getInvitationStatus(invitation);
                      const canResumeOnBehalf = isOnBehalf && (status === 'in_progress' || status === 'used');
                      const showResend = !isOnBehalf && (status === 'pending' || status === 'used' || status === 'in_progress' || status === 'expired');
                      const resendLabel = status === 'expired' ? 'Resend Invitation' : 'Resend Email';
                      const isSending = sendEmailInvitation.isPending && sendEmailInvitation.variables === invitation.id;
                      const handleResend = async () => {
                        if (status === 'expired') {
                          const newExpiry = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
                          const { error } = await supabase
                            .from('vendor_invitations')
                            .update({ expires_at: newExpiry })
                            .eq('id', invitation.id);
                          if (error) {
                            toast({ title: 'Could not extend invitation', description: error.message, variant: 'destructive' });
                            return;
                          }
                          queryClient.invalidateQueries({ queryKey: ['vendor-invitations'] });
                        }
                        sendEmailInvitation.mutate(invitation.id);
                      };
                      return (
                      <TableRow key={invitation.id}>
                        <TableCell className="text-muted-foreground">
                          {(invitation as any).tenants?.name ?? '—'}
                        </TableCell>
                        <TableCell>
                          {(invitation as any).vendor_name ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>{(invitation as any).vendor_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                          {isOnBehalf && (
                            <div className="mt-1">
                              <Badge variant="secondary" className="gap-1">
                                <UserPlus className="h-3 w-3" />
                                On behalf
                              </Badge>
                            </div>
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
                          {formatDate(invitation.created_at)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(invitation.expires_at)}
                        </TableCell>
                        <TableCell>{getStatusBadge(invitation)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canResumeOnBehalf && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => navigate(`/vendor/registration?onBehalfOf=${invitation.id}`)}
                                className="gap-1"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Resume
                              </Button>
                            )}
                            {showResend && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleResend}
                                disabled={isSending}
                                className="gap-1"
                              >
                                {isSending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Send className="h-4 w-4" />
                                    {resendLabel}
                                  </>
                                )}
                              </Button>
                            )}
                            {isOnBehalf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete on-behalf draft"
                                onClick={async () => {
                                  const confirmRes = await Swal.fire({
                                    title: 'Are you sure?',
                                    text: 'This will permanently delete this on-behalf draft and its vendor record.',
                                    icon: 'warning',
                                    showCancelButton: true,
                                    confirmButtonText: 'Yes, delete',
                                    cancelButtonText: 'Cancel',
                                    confirmButtonColor: '#dc2626',
                                    reverseButtons: true,
                                  });
                                  if (!confirmRes.isConfirmed) return;
                                  try {
                                    const vId = (invitation as any).vendor_id as string | null;
                                    // 1) Delete any draft vendor referencing this invitation
                                    const orFilter = vId
                                      ? `invitation_id.eq.${invitation.id},id.eq.${vId}`
                                      : `invitation_id.eq.${invitation.id}`;
                                    const { error: vDelErr } = await supabase
                                      .from('vendors')
                                      .delete()
                                      .eq('status', 'draft')
                                      .or(orFilter);
                                    if (vDelErr) throw vDelErr;
                                    // 2) Null out any leftover references from non-draft vendors
                                    const { error: vNullErr } = await supabase
                                      .from('vendors')
                                      .update({ invitation_id: null } as any)
                                      .eq('invitation_id', invitation.id);
                                    if (vNullErr) throw vNullErr;
                                    // 3) Delete the invitation
                                    const { error: iErr } = await supabase
                                      .from('vendor_invitations')
                                      .delete()
                                      .eq('id', invitation.id);
                                    if (iErr) throw iErr;
                                    queryClient.invalidateQueries({ queryKey: ['vendor-invitations'] });
                                    await Swal.fire({
                                      icon: 'success',
                                      title: 'Deleted',
                                      timer: 1500,
                                      showConfirmButton: false,
                                    });
                                  } catch (e: any) {
                                    await Swal.fire({
                                      icon: 'error',
                                      title: 'Could not delete',
                                      text: e?.message ?? String(e),
                                    });
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
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

