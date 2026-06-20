import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import OnboardingPage from "./pages/OnboardingPage";
import CheckupPage from "./pages/CheckupPage";
import PlannerPage from "./pages/PlannerPage";
import EducatePage from "./pages/EducatePage";
import ProfilePage from "./pages/ProfilePage";
import AppLayout from "./components/layout/AppLayout";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#0d9488",
    colorForeground: "#0f172a",
    colorMutedForeground: "#64748b",
    colorDanger: "#dc2626",
    colorBackground: "#ffffff",
    colorInput: "#f8fafc",
    colorInputForeground: "#0f172a",
    colorNeutral: "#cbd5e1",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-slate-200",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-slate-900 font-semibold",
    headerSubtitle: "text-slate-500",
    socialButtonsBlockButtonText: "text-slate-700",
    formFieldLabel: "text-slate-700",
    footerActionLink: "text-teal-600 hover:text-teal-700",
    footerActionText: "text-slate-500",
    dividerText: "text-slate-400",
    identityPreviewEditButton: "text-teal-600",
    formFieldSuccessText: "text-teal-600",
    alertText: "text-red-600",
    logoBox: "flex justify-center",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border-slate-200 hover:bg-slate-50",
    formButtonPrimary: "bg-teal-600 hover:bg-teal-700 text-white",
    formFieldInput: "border-slate-200 bg-slate-50 text-slate-900",
    footerAction: "bg-slate-50",
    dividerLine: "bg-slate-200",
    alert: "bg-red-50 border-red-200",
    otpCodeFieldInput: "border-slate-200",
    formFieldRow: "",
    main: "",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClientLocal = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClientLocal.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClientLocal]);
  return null;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/">
        <Show when="signed-out"><LandingPage /></Show>
        <Show when="signed-in"><Redirect to="/dashboard" /></Show>
      </Route>
      <Route path="/dashboard/*?">
        <Show when="signed-in">
          <AppLayout>
            <DashboardPage />
          </AppLayout>
        </Show>
        <Show when="signed-out"><Redirect to="/" /></Show>
      </Route>
      <Route path="/onboarding">
        <Show when="signed-in"><OnboardingPage /></Show>
        <Show when="signed-out"><Redirect to="/" /></Show>
      </Route>
      <Route path="/checkup">
        <Show when="signed-in">
          <AppLayout>
            <CheckupPage />
          </AppLayout>
        </Show>
        <Show when="signed-out"><Redirect to="/" /></Show>
      </Route>
      <Route path="/planner">
        <Show when="signed-in">
          <AppLayout>
            <PlannerPage />
          </AppLayout>
        </Show>
        <Show when="signed-out"><Redirect to="/" /></Show>
      </Route>
      <Route path="/educate">
        <Show when="signed-in">
          <AppLayout>
            <EducatePage />
          </AppLayout>
        </Show>
        <Show when="signed-out"><Redirect to="/" /></Show>
      </Route>
      <Route path="/profile">
        <Show when="signed-in">
          <AppLayout>
            <ProfilePage />
          </AppLayout>
        </Show>
        <Show when="signed-out"><Redirect to="/" /></Show>
      </Route>
      <Route path="/sign-in/*?">
        <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
          <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
        </div>
      </Route>
      <Route path="/sign-up/*?">
        <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
          <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
        </div>
      </Route>
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{ signIn: { start: { title: "Welcome back to VitalGuide", subtitle: "Your personal health companion" } }, signUp: { start: { title: "Join VitalGuide", subtitle: "Start your health journey today" } } }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <AppRoutes />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
