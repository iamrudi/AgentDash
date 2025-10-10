import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { ClientLayout } from "@/components/client-layout";
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
import Reports from "@/pages/client/reports";
import Profile from "@/pages/client/profile";
import Support from "@/pages/client/support";

// Agency Portal Pages
import AgencyDashboard from "@/pages/agency/index";
import AgencyMessages from "@/pages/agency/messages";
import AgencyTasks from "@/pages/agency/tasks";
import AgencyRecommendations from "@/pages/agency/recommendations";
import AgencyClients from "@/pages/agency/clients";
import AgencyStaff from "@/pages/agency/staff";
import AgencyIntegrations from "@/pages/agency/integrations";
import AgencyUsers from "@/pages/agency/users";
import AgencyInvoices from "@/pages/agency/invoices";

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
      
      {/* Agency Portal */}
      <Route path="/agency">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyDashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/agency/messages">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyMessages />
        </ProtectedRoute>
      </Route>

      <Route path="/agency/tasks">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyTasks />
        </ProtectedRoute>
      </Route>

      <Route path="/agency/recommendations">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyRecommendations />
        </ProtectedRoute>
      </Route>

      <Route path="/agency/clients">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyClients />
        </ProtectedRoute>
      </Route>

      <Route path="/agency/staff">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyStaff />
        </ProtectedRoute>
      </Route>

      <Route path="/agency/users">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyUsers />
        </ProtectedRoute>
      </Route>

      <Route path="/agency/integrations">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyIntegrations />
        </ProtectedRoute>
      </Route>

      <Route path="/agency/invoices">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <AgencyInvoices />
        </ProtectedRoute>
      </Route>

      <Route path="/agency/clients/:clientId">
        <ProtectedRoute allowedRoles={["Admin"]}>
          <ClientDetail />
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
