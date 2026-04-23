import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  UserCircle,
} from "lucide-react";
import { useState, useEffect } from "react";

export type Page = "dashboard" | "chat" | "admin" | "connections" | "account";

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  user: { email: string; name: string; profilePictureUrl?: string; role?: string } | null;
  onLogout: () => void;
}

const NAV_ITEMS: { page: Page; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }[] = [
  { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { page: "chat", label: "Chat", icon: MessageSquare },
  { page: "connections", label: "Services", icon: Settings },
  { page: "admin", label: "Admin", icon: Shield, adminOnly: true },
  { page: "account", label: "My Account", icon: UserCircle },
];

const BREAKPOINT = 768;

export default function Sidebar({ activePage, onNavigate, user, onLogout }: SidebarProps) {
  const [manualCollapse, setManualCollapse] = useState<boolean | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(
    typeof window !== "undefined" ? window.innerWidth < BREAKPOINT : false,
  );

  useEffect(() => {
    function handleResize() {
      setIsSmallScreen(window.innerWidth < BREAKPOINT);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setManualCollapse(null);
  }, [isSmallScreen]);

  const collapsed = manualCollapse !== null ? manualCollapse : isSmallScreen;

  return (
    <aside
      className={`h-dvh shrink-0 flex flex-col border-r border-border/50 bg-card transition-all duration-200 ${
        collapsed ? "w-[60px]" : "w-[200px]"
      }`}
    >
      <div className={`h-14 shrink-0 flex items-center border-b border-border/50 ${collapsed ? "justify-center px-0" : "px-4"}`}>
        {!collapsed && (
          <span className="text-sm font-bold text-foreground tracking-tight truncate">
            WorkHub
          </span>
        )}
        <button
          onClick={() => setManualCollapse(!collapsed)}
          className={`flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ${
            collapsed ? "" : "ml-auto"
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 py-2 px-2 space-y-1">
        {NAV_ITEMS.filter(({ adminOnly }) => !adminOnly || user?.role === "super_admin").map(({ page, label, icon: Icon }) => {
          const isActive = activePage === page;
          return (
            <button
              key={page}
              data-tour={`nav-${page}`}
              onClick={() => onNavigate(page)}
              title={collapsed ? label : undefined}
              className={`w-full flex items-center gap-3 rounded-lg transition-colors text-sm font-medium ${
                collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
              } ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border/50 p-2 space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-foreground truncate">
              {user.name || user.email}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        )}
        <button
          onClick={onLogout}
          title={collapsed ? "Sign out" : undefined}
          className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ${
            collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
          }`}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
