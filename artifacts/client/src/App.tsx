import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import AppLayout from "@/components/app-layout";
import { type Page } from "@/components/sidebar";
import DashboardPage from "@/pages/dashboard-page";
import ChatPage from "@/pages/chat-page";
import LoginPage from "@/pages/login-page";
import AdminPage from "@/pages/admin-page";
import ConnectionsPage from "@/pages/connections-page";
import AccountPage from "@/pages/account-page";
import OnboardingTour, { isTourCompleted, type TourStep } from "@/components/onboarding-tour";
import { ToolVisibilityProvider } from "@/lib/tool-visibility";

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
    target: "nav-connections",
    title: "Connected Services",
    description: "Connect your accounts here — Jira, Zoho, STS, and Teamwork. Each service needs a one-time setup before you can query it in chat.",
    position: "right",
    navigateTo: "connections",
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

function AuthGate() {
  const {
    isAuthenticated, user, token,
    login, register, logout, verify2fa, cancel2fa,
    isLoading, requires2fa, updateUser,
  } = useAuth();
  const [page, setPage] = useState<Page>("dashboard");
  const [lastAuthUser, setLastAuthUser] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    let tourTimer: ReturnType<typeof setTimeout> | null = null;
    if (isAuthenticated && user) {
      const currentEmail = user.email;
      if (currentEmail !== lastAuthUser) {
        setLastAuthUser(currentEmail);
        const validPages: Page[] = ["dashboard", "chat", "admin", "connections", "account"];
        const candidate = user.defaultPage as Page | undefined;
        if (candidate === "admin" && user.role !== "super_admin") {
          setPage("dashboard");
        } else if (candidate && validPages.includes(candidate)) {
          setPage(candidate);
        } else {
          setPage("dashboard");
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

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={login}
        onRegister={register}
        onVerify2fa={verify2fa}
        onCancel2fa={cancel2fa}
        isLoading={isLoading}
        requires2fa={requires2fa}
      />
    );
  }

  let content: React.ReactNode;

  if (page === "admin") {
    content = <AdminPage userRole={user?.role} />;
  } else if (page === "connections") {
    content = <ConnectionsPage token={token} />;
  } else if (page === "chat") {
    content = <ChatPage />;
  } else if (page === "account") {
    content = <AccountPage token={token} onUpdateUser={updateUser} onRestartTour={() => setShowTour(true)} userEmail={user?.email} />;
  } else {
    content = (
      <DashboardPage
        user={user}
        token={token}
        onOpenChat={() => setPage("chat")}
        onOpenConnections={() => setPage("connections")}
      />
    );
  }

  return (
    <ToolVisibilityProvider
      key={user?.email ?? "anon"}
      token={token}
      initialHiddenTools={user?.hiddenTools}
    >
      <AppLayout
        activePage={page}
        onNavigate={setPage}
        user={user}
        onLogout={logout}
      >
        {content}
      </AppLayout>
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
    </QueryClientProvider>
  );
}

export default App;
