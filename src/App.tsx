import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenantContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";

import VendorRegistration from "./pages/VendorRegistration";
import VendorRegisterWithInvite from "./pages/VendorRegisterWithInvite";

import VendorLogin from "./pages/VendorLogin";
import VendorInviteAccept from "./pages/VendorInviteAccept";
import Dashboard from "./pages/Dashboard";
import FinanceReview from "./pages/FinanceReview";
import PurchaseApproval from "./pages/PurchaseApproval";
import SAPSync from "./pages/SAPSync";
import SapApiSettings from "./pages/SapApiSettings";
import SapApiConfigEdit from "./pages/SapApiConfigEdit";
import KycApiSettings from "./pages/KycApiSettings";
import KycApiConfigEdit from "./pages/KycApiConfigEdit";
import VendorList from "./pages/VendorList";
import VendorStatus from "./pages/VendorStatus";

import AuditLogs from "./pages/AuditLogs";
import AdminConfiguration from "./pages/AdminConfiguration";
import AdminInvitations from "./pages/AdminInvitations";
import UserManagement from "./pages/UserManagement";
import SupportHelp from "./pages/SupportHelp";
import VendorFeedback from "./pages/VendorFeedback";
import DemoShowcase from "./pages/DemoShowcase";
import GstCompliance from "./pages/GstCompliance";
import ScheduledChecks from "./pages/ScheduledChecks";
import SharviAdminConsole from "./pages/SharviAdminConsole";
import FormBuilder from "./pages/FormBuilder";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";

import EmailConfiguration from "./pages/EmailConfiguration";
import BuyerApproval from "./pages/approvals/BuyerApproval";
import ScmManagerApproval from "./pages/approvals/ScmManagerApproval";
import ScmHeadApproval from "./pages/approvals/ScmHeadApproval";
import Finance1Approval from "./pages/approvals/Finance1Approval";
import Finance2Approval from "./pages/approvals/Finance2Approval";
import CeoApproval from "./pages/approvals/CeoApproval";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
          <Routes>
            {/* Public Routes - Auth is the main entry */}
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/vendor/login" element={<VendorLogin />} />
            <Route path="/vendor/invite" element={<VendorInviteAccept />} />
            <Route path="/vendor/registration" element={<VendorRegistration />} />
            <Route path="/install" element={<Install />} />
            <Route path="/feedback" element={<VendorFeedback />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              {/* Finance Routes */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                
                <Route path="/finance/review" element={<FinanceReview />} />
                <Route path="/purchase/approval" element={<PurchaseApproval />} />
                <Route path="/sap/sync" element={<SAPSync />} />
                <Route path="/sap/api-settings" element={<SapApiSettings />} />
                <Route path="/sap/api-settings/:configId" element={<SapApiConfigEdit />} />
                <Route path="/admin/kyc-api-settings" element={<KycApiSettings />} />
                <Route path="/admin/kyc-api-settings/:id" element={<KycApiConfigEdit />} />
                <Route path="/vendors" element={<VendorList />} />
                <Route path="/vendor-status/:id" element={<VendorStatus />} />

                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/settings" element={<AdminConfiguration />} />
                <Route path="/admin/invitations" element={<AdminInvitations />} />
                <Route path="/admin/users" element={<UserManagement />} />
                <Route path="/admin/role-permissions" element={<Navigate to="/admin/users" replace />} />
                <Route path="/admin/custom-roles" element={<Navigate to="/admin/users" replace />} />
                <Route path="/support" element={<SupportHelp />} />
                <Route path="/demo" element={<DemoShowcase />} />
                <Route path="/compliance/gst" element={<GstCompliance />} />
                <Route path="/compliance/scheduled" element={<ScheduledChecks />} />
                <Route path="/sharvi-admin" element={<SharviAdminConsole />} />
                <Route path="/admin/form-builder" element={<FormBuilder />} />
                
                <Route path="/approvals/buyer" element={<BuyerApproval />} />
                <Route path="/approvals/scm-manager" element={<ScmManagerApproval />} />
                <Route path="/approvals/scm-head" element={<ScmHeadApproval />} />
                <Route path="/approvals/finance-1" element={<Finance1Approval />} />
                <Route path="/approvals/finance-2" element={<Finance2Approval />} />
                <Route path="/approvals/ceo" element={<CeoApproval />} />
                <Route path="/admin/email-config" element={<EmailConfiguration />} />
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
