import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { ClientLayout } from "@/components/client-layout";
import { AgencyLayout } from "@/components/agency-layout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ClientDetail from "@/pages/client-detail";
import StaffDashboard from "@/pages/staff-dashboard";

// Client Portal Pages
import Dashboard from "@/pages/client/dashboard";
import Projects from "@/pages/client/projects";
import Recommendations from "@/pages/client/recommendations";
import Billing from "@/pages/client/billing";
import InvoiceDetail from "@/pages/client/invoice-detail";
import Reports from "@/pages/client/reports";
import Profile from "@/pages/client/profile";
import Support from "@/pages/client/support";

// Agency Portal Pages
import AgencyDashboard from "@/pages/agency/index";
import AgencyMessages from "@/pages/agency/messages";
import AgencyTasks from "@/pages/agency/tasks";
import AgencyProjects from "@/pages/agency/projects";
import AgencyProjectDetail from "@/pages/agency/project-detail";
import AgencyRecommendations from "@/pages/agency/recommendations";
import AgencyClients from "@/pages/agency/clients";
import AgencyStaff from "@/pages/agency/staff";
import AgencyIntegrations from "@/pages/agency/integrations";
import AgencyContentCopilot from "@/pages/agency/content-copilot";
import AgencyUsers from "@/pages/agency/users";
import AgencyInvoices from "@/pages/agency/invoices";
import AgencyTrash from "@/pages/agency/trash";
import AgencySeoAudit from "@/pages/agency/seo-audit";
import AgencySettings from "@/pages/agency/settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      
      {/* Client Portal - All routes wrapped in ClientLayout */}
      <Route path="/client">
        <ProtectedRoute allowedRoles={["Client"]}>
          <ClientLayout>
            <Dashboard />
          </ClientLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/client/projects">
        <ProtectedRoute allowedRoles={["Client"]}>
          <ClientLayout>
            <Projects />
          </ClientLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/client/recommendations">
        <ProtectedRoute allowedRoles={["Client"]}>
          <ClientLayout>
            <Recommendations />
          </ClientLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/client/billing">
        <ProtectedRoute allowedRoles={["Client"]}>
          <ClientLayout>
            <Billing />
          </ClientLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/client/invoices/:id">
        <ProtectedRoute allowedRoles={["Client"]}>
          <ClientLayout>
            <InvoiceDetail />
          </ClientLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/client/reports">
        <ProtectedRoute allowedRoles={["Client"]}>
          <ClientLayout>
            <Reports />
          </ClientLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/client/profile">
        <ProtectedRoute allowedRoles={["Client"]}>
          <ClientLayout>
            <Profile />
          </ClientLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/client/support">
        <ProtectedRoute allowedRoles={["Client"]}>
          <ClientLayout>
            <Support />
          </ClientLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Agency Portal - All routes wrapped in AgencyLayout */}
      <Route path="/agency">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencyDashboard />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/messages">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencyMessages />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/tasks">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencyTasks />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/projects">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencyProjects />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/projects/:id">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencyProjectDetail />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/recommendations">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencyRecommendations />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/clients">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencyClients />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/staff">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencyStaff />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/users">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencyUsers />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/integrations">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencyIntegrations />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/content-copilot">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencyContentCopilot />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/invoices">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencyInvoices />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/trash">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencyTrash />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/seo-audit">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencySeoAudit />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/settings">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <AgencySettings />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/clients/:clientId">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyLayout>
            <ClientDetail />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Staff Portal */}
      <Route path="/staff">
        <ProtectedRoute allowedRoles={["Staff"]}>
          <StaffDashboard />
        </ProtectedRoute>
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
