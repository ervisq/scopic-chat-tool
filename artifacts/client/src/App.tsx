import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ChatPage from "./pages/chat-page";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={ChatPage} />
      <Route>
        <div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-background text-foreground px-4 text-center">
          <div className="text-4xl font-display font-bold text-muted-foreground">404</div>
          <h2 className="text-xl font-medium">Page not found</h2>
          <a href="/" className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
            Return to Chat
          </a>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
