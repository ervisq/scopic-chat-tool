import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import ChatPage from "@/pages/chat-page";
import LoginPage from "@/pages/login-page";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGate() {
  const { isAuthenticated, user, login, logout, isLoading } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} isLoading={isLoading} />;
  }

  return <ChatPage user={user} onLogout={logout} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}

export default App;
