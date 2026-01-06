import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import VendorRegistration from "./pages/VendorRegistration";
import Dashboard from "./pages/Dashboard";
import FinanceReview from "./pages/FinanceReview";
import PurchaseApproval from "./pages/PurchaseApproval";
import VendorList from "./pages/VendorList";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Index />} />
          <Route path="/vendor/register" element={<VendorRegistration />} />
          
          {/* Finance Routes */}
          <Route element={<AppLayout userRole="finance" userName="Suresh Reddy" />}>
            <Route path="/finance/dashboard" element={<Dashboard userRole="finance" />} />
            <Route path="/dashboard" element={<Dashboard userRole="finance" />} />
            <Route path="/finance/review" element={<FinanceReview />} />
            <Route path="/vendors" element={<VendorList />} />
          </Route>
          
          {/* Purchase Routes */}
          <Route element={<AppLayout userRole="purchase" userName="Mahesh Kumar" />}>
            <Route path="/purchase/dashboard" element={<Dashboard userRole="purchase" />} />
            <Route path="/purchase/approval" element={<PurchaseApproval />} />
          </Route>
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
