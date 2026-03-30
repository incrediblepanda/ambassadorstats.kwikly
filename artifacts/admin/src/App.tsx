import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ProtectedRoute } from "@/hooks/auth-provider";
import { Layout } from "@/components/layout";

import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Ambassadors from "./pages/ambassadors";
import AmbassadorDetail from "./pages/ambassador-detail";
import Leads from "./pages/leads";
import SyncJobs from "./pages/sync-jobs";
import Settings from "./pages/settings";
import PublicDashboard from "./pages/public-dashboard";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/dashboard/:shortCode" component={PublicDashboard} />
      <Route path="/login" component={Login} />
      <Route path="/">
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/ambassadors">
        <ProtectedRoute>
          <Layout>
            <Ambassadors />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/ambassadors/:id">
        <ProtectedRoute>
          <Layout>
            <AmbassadorDetail />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/leads">
        <ProtectedRoute>
          <Layout>
            <Leads />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/sync-jobs">
        <ProtectedRoute>
          <Layout>
            <SyncJobs />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <Layout>
            <Settings />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
