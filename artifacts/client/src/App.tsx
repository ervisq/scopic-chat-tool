import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import AppLayout from "@/components/app-layout";
import { type Page } from "@/components/sidebar";
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

  let content: React.ReactNode;

  if (page === "admin") {
    content = <AdminPage />;
  } else if (page === "connections") {
    content = <ConnectionsPage token={token} />;
  } else if (page === "chat") {
    content = <ChatPage />;
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
    <AppLayout
      activePage={page}
      onNavigate={setPage}
      user={user}
      onLogout={logout}
    >
      {content}
    </AppLayout>
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
