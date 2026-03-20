import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import DashboardPage from "@/pages/dashboard-page";
import ChatPage from "@/pages/chat-page";
import LoginPage from "@/pages/login-page";
import AdminPage from "@/pages/admin-page";
import ConnectionsPage from "@/pages/connections-page";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

type Page = "dashboard" | "chat" | "admin" | "connections";

function AuthGate() {
  const { isAuthenticated, user, token, login, register, logout, isLoading } = useAuth();
  const [page, setPage] = useState<Page>("dashboard");

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} onRegister={register} isLoading={isLoading} />;
  }

  if (page === "admin") {
    return (
      <AdminPage
        onBack={() => setPage("dashboard")}
        onOpenDashboard={() => setPage("dashboard")}
        onOpenChat={() => setPage("chat")}
        onOpenConnections={() => setPage("connections")}
      />
    );
  }

  if (page === "connections") {
    return (
      <ConnectionsPage
        token={token}
        onBack={() => setPage("dashboard")}
        onOpenDashboard={() => setPage("dashboard")}
        onOpenChat={() => setPage("chat")}
        onOpenAdmin={() => setPage("admin")}
      />
    );
  }

  if (page === "chat") {
    return (
      <ChatPage
        user={user}
        onLogout={logout}
        onOpenAdmin={() => setPage("admin")}
        onOpenConnections={() => setPage("connections")}
        onOpenDashboard={() => setPage("dashboard")}
      />
    );
  }

  return (
    <DashboardPage
      user={user}
      token={token}
      onLogout={logout}
      onOpenChat={() => setPage("chat")}
      onOpenAdmin={() => setPage("admin")}
      onOpenConnections={() => setPage("connections")}
    />
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
