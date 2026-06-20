import { useEffect } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { useAuth } from "./hooks/use-auth";

import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import OnboardingPage from "./pages/OnboardingPage";
import CheckupPage from "./pages/CheckupPage";
import PlannerPage from "./pages/PlannerPage";
import EducatePage from "./pages/EducatePage";
import ProfilePage from "./pages/ProfilePage";
import AppLayout from "./components/layout/AppLayout";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) {
    window.location.href = "/api/login";
    return null;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <LandingPage />}
      </Route>
      <Route path="/dashboard/*?">
        <ProtectedRoute>
          <AppLayout><DashboardPage /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/onboarding">
        <ProtectedRoute>
          <OnboardingPage />
        </ProtectedRoute>
      </Route>
      <Route path="/checkup">
        <ProtectedRoute>
          <AppLayout><CheckupPage /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/planner">
        <ProtectedRoute>
          <AppLayout><PlannerPage /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/educate">
        <ProtectedRoute>
          <AppLayout><EducatePage /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          <AppLayout><ProfilePage /></AppLayout>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={basePath}>
        <AppRoutes />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
