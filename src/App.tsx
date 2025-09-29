import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { queryClient } from "@/lib/react-query";

// Auth pages
import LoginPage from "@/pages/(auth)/login/page";

// Protected pages
import ProtectedLayout from "@/pages/(protected)/layout";
import Dashboard from "@/pages/(protected)/page";
import DomainsPage from "@/pages/(protected)/domains/page";
import DomainsNewPage from "@/pages/(protected)/domains/new/page";
import DomainDetailPage from "@/pages/(protected)/domains/[id]/page";
import VpsPage from "@/pages/(protected)/vps/page";
import VpsNewPage from "@/pages/(protected)/vps/new/page";
import VpsDetailPage from "@/pages/(protected)/vps/[id]/page";
import TenantsPage from "@/pages/(protected)/tenants/page";
import TenantDetailPage from "@/pages/(protected)/tenants/[id]/page";
import SettingsPage from "@/pages/(protected)/settings/page";

import NotFound from "@/pages/NotFound";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="tenants" element={<TenantsPage />} />
              <Route path="tenants/:id" element={<TenantDetailPage />} />
              <Route path="domains" element={<DomainsPage />} />
              <Route path="domains/new" element={<DomainsNewPage />} />
              <Route path="domains/:id" element={<DomainDetailPage />} />
              <Route path="vps" element={<VpsPage />} />
              <Route path="vps/new" element={<VpsNewPage />} />
              <Route path="vps/:id" element={<VpsDetailPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
