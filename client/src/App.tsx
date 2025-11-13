import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { ClientLayout } from "@/components/client-layout";
import { AgencyLayout } from "@/components/agency-layout";
import { AuthProvider } from "@/context/auth-provider";

// Lazy-loaded pages for code splitting
const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/home"));
const Login = lazy(() => import("@/pages/login"));
const Signup = lazy(() => import("@/pages/signup"));
const ClientDetail = lazy(() => import("@/pages/client-detail"));
const StaffDashboard = lazy(() => import("@/pages/staff-dashboard"));
const EmbedForm = lazy(() => import("@/pages/forms/embed"));

// Client Portal Pages (lazy-loaded)
const Dashboard = lazy(() => import("@/pages/client/dashboard"));
const Projects = lazy(() => import("@/pages/client/projects"));
const Recommendations = lazy(() => import("@/pages/client/recommendations"));
const Billing = lazy(() => import("@/pages/client/billing"));
const InvoiceDetail = lazy(() => import("@/pages/client/invoice-detail"));
const Reports = lazy(() => import("@/pages/client/reports"));
const Profile = lazy(() => import("@/pages/client/profile"));
const Support = lazy(() => import("@/pages/client/support"));

// Agency Portal Pages (lazy-loaded)
const AgencyDashboard = lazy(() => import("@/pages/agency/index"));
const AgencyMessages = lazy(() => import("@/pages/agency/messages"));
const AgencyTasks = lazy(() => import("@/pages/agency/tasks"));
const AgencyProjects = lazy(() => import("@/pages/agency/projects"));
const AgencyProjectDetail = lazy(() => import("@/pages/agency/project-detail"));
const AgencyRecommendations = lazy(() => import("@/pages/agency/recommendations"));
const AgencyClients = lazy(() => import("@/pages/agency/clients"));
const AgencyStaff = lazy(() => import("@/pages/agency/staff"));
const AgencyIntegrations = lazy(() => import("@/pages/agency/integrations"));
const AgencyUsers = lazy(() => import("@/pages/agency/users"));
const AgencyInvoices = lazy(() => import("@/pages/agency/invoices"));
const AgencyTrash = lazy(() => import("@/pages/agency/trash"));
const AgencySettings = lazy(() => import("@/pages/agency/settings"));

// Super Admin Portal Pages (lazy-loaded)
const SuperAdminPortal = lazy(() => import("@/pages/superadmin/index"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      
      {/* Public Form Embed (no auth required) */}
      <Route path="/forms/embed/:publicId" component={EmbedForm} />
      
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
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
          <AgencyLayout>
            <AgencyDashboard />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/messages">
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
          <AgencyLayout>
            <AgencyMessages />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/tasks">
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
          <AgencyLayout>
            <AgencyTasks />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/projects">
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
          <AgencyLayout>
            <AgencyProjects />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/projects/:id">
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
          <AgencyLayout>
            <AgencyProjectDetail />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/recommendations">
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
          <AgencyLayout>
            <AgencyRecommendations />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/clients">
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
          <AgencyLayout>
            <AgencyClients />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/staff">
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
          <AgencyLayout>
            <AgencyStaff />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/users">
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
          <AgencyLayout>
            <AgencyUsers />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/integrations">
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
          <AgencyLayout>
            <AgencyIntegrations />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/invoices">
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
          <AgencyLayout>
            <AgencyInvoices />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/trash">
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
          <AgencyLayout>
            <AgencyTrash />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/settings">
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
          <AgencyLayout>
            <AgencySettings />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/agency/clients/:clientId">
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]}>
          <AgencyLayout>
            <ClientDetail />
          </AgencyLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Super Admin Portal */}
      <Route path="/superadmin">
        <ProtectedRoute allowedRoles={["Admin", "SuperAdmin"]} requireSuperAdmin={true}>
          <AgencyLayout>
            <SuperAdminPortal />
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
      <AuthProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Suspense fallback={<PageLoader />}>
              <Router />
            </Suspense>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
