import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
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
  const [page, setPage] = useState<"chat" | "admin" | "connections">("chat");

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
    return <AdminPage onBack={() => setPage("chat")} />;
  }

  if (page === "connections") {
    return <ConnectionsPage token={token} onBack={() => setPage("chat")} />;
  }

  return (
    <ChatPage
      user={user}
      onLogout={logout}
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
