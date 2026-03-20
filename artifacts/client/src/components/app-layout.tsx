import Sidebar, { type Page } from "@/components/sidebar";

interface AppLayoutProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  user: { email: string; name: string } | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function AppLayout({ activePage, onNavigate, user, onLogout, children }: AppLayoutProps) {
  return (
    <div className="flex h-dvh bg-background">
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        user={user}
        onLogout={onLogout}
      />
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
