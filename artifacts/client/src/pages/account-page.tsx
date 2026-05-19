import { useState, useEffect, useRef } from "react";
import {
  UserCircle,
  Camera,
  Loader2,
  Moon,
  Sun,
  CheckCircle2,
  KeyRound,
} from "lucide-react";
import { resetTourCompleted } from "@/components/onboarding-tour";
import { ToolVisibilityPanel } from "@/components/tool-visibility-panel";

interface UserUpdate {
  name?: string;
  phone?: string;
  profilePictureUrl?: string;
  theme?: string;
  defaultPage?: string;
  totpEnabled?: boolean;
}

interface AccountPageProps {
  token: string | null;
  onUpdateUser: (user: UserUpdate) => void;
  onSetToken: (token: string) => void;
  onRestartTour?: () => void;
  userEmail?: string;
}

type Tab = "general" | "preferences";

const TABS: { key: Tab; label: string }[] = [
  { key: "general", label: "General Information" },
  { key: "preferences", label: "Preferences" },
];

export default function AccountPage({ token, onUpdateUser, onSetToken, onRestartTour, userEmail }: AccountPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("general");

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="h-14 shrink-0 flex items-center px-4 md:px-6 border-b border-border/50 bg-background z-10">
        <div className="flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-primary" />
          <h1 className="text-base font-semibold text-foreground">My Account</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
          <div className="flex gap-1 mb-6 bg-muted/30 rounded-xl p-1">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "general" && (
            <GeneralTab token={token} onUpdateUser={onUpdateUser} onSetToken={onSetToken} />
          )}
          {activeTab === "preferences" && (
            <PreferencesTab token={token} onUpdateUser={onUpdateUser} onRestartTour={onRestartTour} userEmail={userEmail} />
          )}
        </div>
      </div>
    </div>
  );
}

function GeneralTab({ token, onUpdateUser }: { token: string | null; onUpdateUser: (u: UserUpdate) => void; onSetToken: (token: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profilePicture, setProfilePicture] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch(`${baseUrl}/api/account/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setName(data.name);
        setEmail(data.email);
        setPhone(data.phone || "");
        setProfilePicture(data.profilePictureUrl || "");
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${baseUrl}/api/account/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, phone, profilePictureUrl: profilePicture }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessage({ type: "success", text: "Profile updated successfully" });
        onUpdateUser({ name: data.name, phone: data.phone, profilePictureUrl: data.profilePictureUrl });
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.message || "Failed to update" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image must be under 1.5MB" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfilePicture(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Profile</h2>

        {message && (
          <div className={`p-3 rounded-lg text-sm mb-4 ${message.type === "success" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
            {message.text}
          </div>
        )}

        <div className="flex items-center gap-4 mb-5">
          <div className="relative group">
            {profilePicture ? (
              <img
                src={profilePicture}
                alt="Profile"
                className="w-16 h-16 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                <UserCircle className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{name || "Your Name"}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
            <div className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
              <KeyRound className="w-3 h-3" />
              Signed in with Scopic SSO
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3 py-2 rounded-lg border border-border bg-muted/50 text-muted-foreground text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-sm"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

function PreferencesTab({ token, onUpdateUser, onRestartTour, userEmail }: { token: string | null; onUpdateUser: (u: UserUpdate) => void; onRestartTour?: () => void; userEmail?: string }) {
  const [theme, setTheme] = useState("light");
  const [defaultPage, setDefaultPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    fetchPreferences();
  }, []);

  async function fetchPreferences() {
    try {
      const res = await fetch(`${baseUrl}/api/account/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTheme(data.theme || "light");
        setDefaultPage(data.defaultPage || "dashboard");
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  async function savePreferences(
    updates: { theme?: string; defaultPage?: string },
    rollback: () => void,
  ) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${baseUrl}/api/account/preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setMessage({ type: "success", text: "Preferences saved" });
        onUpdateUser({ theme: data.theme, defaultPage: data.defaultPage });
      } else {
        const err = await res.json();
        rollback();
        setMessage({ type: "error", text: err.message || "Failed to save" });
      }
    } catch {
      rollback();
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  function handleThemeChange(newTheme: string) {
    const prev = theme;
    setTheme(newTheme);
    savePreferences({ theme: newTheme }, () => setTheme(prev));
  }

  function handleDefaultPageChange(page: string) {
    const prev = defaultPage;
    setDefaultPage(page);
    savePreferences({ defaultPage: page }, () => setDefaultPage(prev));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const PAGE_OPTIONS = [
    { value: "dashboard", label: "Dashboard" },
    { value: "chat", label: "Chat" },
    { value: "connections", label: "Services" },
    { value: "admin", label: "Admin" },
  ];

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === "success" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
          {message.text}
        </div>
      )}

      <div className="bg-card border border-border/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Theme</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleThemeChange("light")}
            disabled={saving}
            className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              theme === "light"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-border/80"
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
              <Sun className="w-6 h-6 text-amber-500" />
            </div>
            <span className="text-sm font-medium text-foreground">Light</span>
          </button>

          <button
            onClick={() => handleThemeChange("dark")}
            disabled={saving}
            className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              theme === "dark"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-border/80"
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-gray-900 border border-gray-700 flex items-center justify-center shadow-sm">
              <Moon className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-sm font-medium text-foreground">Dark</span>
          </button>
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Default Landing Page</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Choose which page you see first when you log in
        </p>
        <div className="space-y-2">
          {PAGE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleDefaultPageChange(value)}
              disabled={saving}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all text-sm ${
                defaultPage === value
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
              }`}
            >
              <span className="font-medium">{label}</span>
              {defaultPage === value && (
                <CheckCircle2 className="w-4 h-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Tool Visibility</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Hide tools you don't use from the chat pills, @ autocomplete, and dashboard widgets. Hidden tools still work if you type their full query manually.
        </p>
        <ToolVisibilityPanel />
      </div>

      {onRestartTour && (
        <div className="bg-card border border-border/60 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Onboarding Tour</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Take a guided tour of WorkHub to learn about all the features
          </p>
          <button
            onClick={() => {
              resetTourCompleted(userEmail);
              onRestartTour();
            }}
            className="text-xs px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
          >
            Restart Tour
          </button>
        </div>
      )}
    </div>
  );
}

