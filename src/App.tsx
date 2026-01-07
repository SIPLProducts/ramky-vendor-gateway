import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

import Auth from "./pages/Auth";
import VendorRegistration from "./pages/VendorRegistration";
import VendorRegisterWithInvite from "./pages/VendorRegisterWithInvite";
import Dashboard from "./pages/Dashboard";
import FinanceReview from "./pages/FinanceReview";
import PurchaseApproval from "./pages/PurchaseApproval";
import VendorList from "./pages/VendorList";
import AuditLogs from "./pages/AuditLogs";
import AdminConfiguration from "./pages/AdminConfiguration";
import AdminInvitations from "./pages/AdminInvitations";
import DocumentVerification from "./pages/DocumentVerification";
import SupportHelp from "./pages/SupportHelp";
import VendorFeedback from "./pages/VendorFeedback";
import DemoShowcase from "./pages/DemoShowcase";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes - Auth is the main entry */}
            <Route path="/" element={<Auth />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/vendor/register" element={<VendorRegistration />} />
            <Route path="/vendor/invite" element={<VendorRegisterWithInvite />} />
            <Route path="/support" element={<SupportHelp />} />
            <Route path="/feedback" element={<VendorFeedback />} />
            
            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              {/* Finance Routes */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/finance/review" element={<FinanceReview />} />
                <Route path="/finance/verification" element={<DocumentVerification />} />
                <Route path="/purchase/approval" element={<PurchaseApproval />} />
                <Route path="/vendors" element={<VendorList />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/settings" element={<AdminConfiguration />} />
                <Route path="/admin/invitations" element={<AdminInvitations />} />
                <Route path="/demo" element={<DemoShowcase />} />
              </Route>
            </Route>
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
