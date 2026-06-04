import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import AppLayout from "@/components/app-layout";
import { type Page } from "@/components/sidebar";
import DashboardPage from "@/pages/dashboard-page";
import ChatPage from "@/pages/chat-page";
import LoginPage from "@/pages/login-page";
import AuthSsoCallback from "@/pages/auth-sso-callback";
import AdminPage from "@/pages/admin-page";
import AccountPage from "@/pages/account-page";
import OnboardingTour, { isTourCompleted, type TourStep } from "@/components/onboarding-tour";
import { ToolVisibilityProvider, useToolVisibility } from "@/lib/tool-visibility";
import { ObjectDetailProvider } from "@/components/object-detail-provider";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";
import {
  consumeOAuthCallbackMessages,
  consumeOAuthOrigin,
  hadOAuthCallbackParamsAtLoad,
} from "@/lib/connect-service";

function OAuthCallbackNotifier() {
  const { refreshConnectedTools } = useToolVisibility();
  useEffect(() => {
    const messages = consumeOAuthCallbackMessages();
    if (messages.length === 0) return;
    let hadSuccess = false;
    for (const m of messages) {
      toast({
        title: m.type === "success" ? "Connected" : "Connection failed",
        description: m.text,
        variant: m.type === "error" ? "destructive" : "default",
      });
      if (m.type === "success") hadSuccess = true;
    }
    if (hadSuccess) refreshConnectedTools();
  }, []);
  return null;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "nav-dashboard",
    title: "Welcome to WorkHub!",
    description: "This is your company hub for accessing all integrated tools. Let's take a quick tour of what's available.",
    position: "right",
    navigateTo: "dashboard",
  },
  {
    target: "nav-dashboard",
    title: "Dashboard",
    description: "Your dashboard shows a quick overview of connected services — recent Jira tickets, hours logged, upcoming meetings, and more.",
    position: "right",
  },
  {
    target: "nav-chat",
    title: "AI Chat",
    description: "The chat is where the magic happens. Ask questions in plain English and get data from Jira, Zoho, STS, Teamwork, and Outlook.",
    position: "right",
    navigateTo: "chat",
  },
  {
    target: "chat-input",
    title: "How to Use Chat",
    description: "Just type naturally — like \"how many hours did I log this week\" or \"my open Jira tickets\". You can also type @ to see available tools.",
    position: "top",
  },
  {
    target: "nav-account",
    title: "Your Account",
    description: "Manage your profile, change your theme, set your default landing page, and configure security settings.",
    position: "right",
  },
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function isSsoCallbackRoute(): boolean {
  if (typeof window === "undefined") return false;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  const path = window.location.pathname;
  return path === `${base}/auth/sso-callback` || path === `${base}/auth/sso-callback/`;
}

function getSsoErrorFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const err = new URLSearchParams(window.location.search).get("error");
  if (!err) return null;
  // Strip the param from the URL so a reload doesn't keep the error visible.
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "") || "/";
  window.history.replaceState({}, "", base);
  return err;
}

function AuthGate() {
  const [onSsoCallback] = useState(() => isSsoCallbackRoute());
  if (onSsoCallback) {
    return <AuthSsoCallback />;
  }
  return <AuthGateInner />;
}

function AuthGateInner() {
  const {
    isAuthenticated, user, token,
    logout,
    isLoading, updateUser, setToken,
  } = useAuth();
  const [ssoError] = useState(() => getSsoErrorFromUrl());
  const [page, setPage] = useState<Page>("dashboard");
  const [lastAuthUser, setLastAuthUser] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    let tourTimer: ReturnType<typeof setTimeout> | null = null;
    if (isAuthenticated && user) {
      const currentEmail = user.email;
      if (currentEmail !== lastAuthUser) {
        setLastAuthUser(currentEmail);
        const validPages: Page[] = ["dashboard", "chat", "admin", "account"];
        // If the user is returning from an OAuth callback (e.g. JIRA/Zoho),
        // restore them to the page they started the connection from rather
        // than their default landing page. Otherwise fall back to the
        // configured default page.
        const oauthOrigin = hadOAuthCallbackParamsAtLoad() ? consumeOAuthOrigin() : null;
        const oauthOriginPage =
          oauthOrigin && validPages.includes(oauthOrigin as Page) ? (oauthOrigin as Page) : null;
        if (oauthOriginPage) {
          if (oauthOriginPage === "admin" && user.role !== "admin") {
            setPage("dashboard");
          } else {
            setPage(oauthOriginPage);
          }
        } else {
          const candidate = user.defaultPage as Page | undefined;
          if (candidate === "admin" && user.role !== "admin") {
            setPage("dashboard");
          } else if (candidate && validPages.includes(candidate)) {
            setPage(candidate);
          } else {
            setPage("dashboard");
          }
        }
        if (!isTourCompleted(user.email)) {
          tourTimer = setTimeout(() => setShowTour(true), 500);
        }
      }
    } else if (!isAuthenticated) {
      setLastAuthUser(null);
      setShowTour(false);
    }
    return () => {
      if (tourTimer) clearTimeout(tourTimer);
    };
  }, [isAuthenticated, user, lastAuthUser]);

  // Only show the full-page spinner during the *initial* token verification
  // (i.e. there is a stored token we are still validating). For in-flight
  // login/register submissions we keep LoginPage mounted so its local state
  // (which tab is active, inline field errors) survives the round-trip; the
  // submit button shows its own inline "Signing in..." / "Creating account..."
  // state via the isLoading prop.
  if (isLoading && token) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage ssoError={ssoError} />;
  }

  let content: React.ReactNode;

  if (page === "admin") {
    content = <AdminPage userRole={user?.role} />;
  } else if (page === "chat") {
    content = <ChatPage onOpenConnections={() => setPage("dashboard")} token={token} />;
  } else if (page === "account") {
    content = <AccountPage token={token} onUpdateUser={updateUser} onSetToken={setToken} onRestartTour={() => setShowTour(true)} userEmail={user?.email} />;
  } else {
    content = (
      <DashboardPage
        user={user}
        token={token}
        onOpenConnections={() => setPage("dashboard")}
      />
    );
  }

  return (
    <ToolVisibilityProvider
      key={user?.email ?? "anon"}
      token={token}
      initialHiddenTools={user?.hiddenTools}
    >
      <OAuthCallbackNotifier />
      <ObjectDetailProvider token={token}>
        <AppLayout
          activePage={page}
          onNavigate={setPage}
          user={user}
          onLogout={logout}
        >
          {content}
        </AppLayout>
      </ObjectDetailProvider>
      {showTour && (
        <OnboardingTour
          steps={TOUR_STEPS}
          onComplete={() => setShowTour(false)}
          onNavigate={(p) => setPage(p as Page)}
          userEmail={user?.email}
        />
      )}
    </ToolVisibilityProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
