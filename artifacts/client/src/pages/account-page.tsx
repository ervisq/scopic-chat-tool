import { useState, useEffect, useRef } from "react";
import {
  UserCircle,
  Camera,
  Loader2,
  Moon,
  Sun,
  Shield,
  QrCode,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
} from "lucide-react";

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
}

type Tab = "general" | "preferences" | "security";

const TABS: { key: Tab; label: string }[] = [
  { key: "general", label: "General Information" },
  { key: "preferences", label: "Preferences" },
  { key: "security", label: "Security" },
];

export default function AccountPage({ token, onUpdateUser }: AccountPageProps) {
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
            <GeneralTab token={token} onUpdateUser={onUpdateUser} />
          )}
          {activeTab === "preferences" && (
            <PreferencesTab token={token} onUpdateUser={onUpdateUser} />
          )}
          {activeTab === "security" && (
            <SecurityTab token={token} />
          )}
        </div>
      </div>
    </div>
  );
}

function GeneralTab({ token, onUpdateUser }: { token: string | null; onUpdateUser: (u: UserUpdate) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profilePicture, setProfilePicture] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "Passwords do not match" });
      return;
    }
    if (newPassword.length < 6) {
      setPwMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }

    setChangingPassword(true);
    setPwMessage(null);
    try {
      const res = await fetch(`${baseUrl}/api/account/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setPwMessage({ type: "success", text: "Password updated successfully" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const err = await res.json();
        setPwMessage({ type: "error", text: err.message || "Failed to change password" });
      }
    } catch {
      setPwMessage({ type: "error", text: "Network error" });
    } finally {
      setChangingPassword(false);
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

      <div className="bg-card border border-border/60 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Update Password</h2>

        {pwMessage && (
          <div className={`p-3 rounded-lg text-sm mb-4 ${pwMessage.type === "success" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
            {pwMessage.text}
          </div>
        )}

        <div className="space-y-3">
          <div className="relative">
            <label className="block text-xs font-medium text-foreground mb-1">Current Password</label>
            <input
              type={showCurrentPw ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-sm"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPw(!showCurrentPw)}
              className="absolute right-3 top-7 text-muted-foreground hover:text-foreground"
            >
              {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative">
            <label className="block text-xs font-medium text-foreground mb-1">New Password</label>
            <input
              type={showNewPw ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-sm"
            />
            <button
              type="button"
              onClick={() => setShowNewPw(!showNewPw)}
              className="absolute right-3 top-7 text-muted-foreground hover:text-foreground"
            >
              {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-sm"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {changingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Update Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreferencesTab({ token, onUpdateUser }: { token: string | null; onUpdateUser: (u: UserUpdate) => void }) {
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
    </div>
  );
}

function SecurityTab({ token }: { token: string | null }) {
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState("weekly");
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<{ qrCode: string; secret: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);

  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch(`${baseUrl}/api/account/2fa/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.enabled);
        setFrequency(data.frequency || "weekly");
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleSetup() {
    setMessage(null);
    try {
      const res = await fetch(`${baseUrl}/api/account/2fa/setup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSetupData({ qrCode: data.qrCode, secret: data.secret });
        setShowSetup(true);
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.message || "Setup failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
  }

  async function handleVerify() {
    if (!verifyCode || verifyCode.length !== 6) {
      setMessage({ type: "error", text: "Enter a valid 6-digit code" });
      return;
    }
    setVerifying(true);
    setMessage(null);
    try {
      const res = await fetch(`${baseUrl}/api/account/2fa/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: verifyCode }),
      });
      if (res.ok) {
        setEnabled(true);
        setShowSetup(false);
        setSetupData(null);
        setVerifyCode("");
        setMessage({ type: "success", text: "Two-factor authentication enabled!" });
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.message || "Verification failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setVerifying(false);
    }
  }

  async function handleDisable() {
    if (!disablePassword) {
      setMessage({ type: "error", text: "Password is required" });
      return;
    }
    setDisabling(true);
    setMessage(null);
    try {
      const res = await fetch(`${baseUrl}/api/account/2fa/disable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: disablePassword }),
      });
      if (res.ok) {
        setEnabled(false);
        setShowDisable(false);
        setDisablePassword("");
        setMessage({ type: "success", text: "Two-factor authentication disabled" });
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.message || "Failed to disable" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setDisabling(false);
    }
  }

  async function handleFrequencyChange(newFreq: string) {
    const previousFreq = frequency;
    setFrequency(newFreq);
    try {
      const res = await fetch(`${baseUrl}/api/account/2fa/frequency`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ frequency: newFreq }),
      });
      if (!res.ok) {
        setFrequency(previousFreq);
        setMessage({ type: "error", text: "Failed to update verification frequency" });
      }
    } catch {
      setFrequency(previousFreq);
      setMessage({ type: "error", text: "Failed to update verification frequency" });
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const FREQUENCY_OPTIONS = [
    { value: "weekly", label: "Every week" },
    { value: "biweekly", label: "Every 2 weeks" },
    { value: "monthly", label: "Every month" },
  ];

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === "success" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
          {message.text}
        </div>
      )}

      <div className="bg-card border border-border/60 rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled ? "bg-emerald-500/10" : "bg-muted"}`}>
              <Shield className={`w-5 h-5 ${enabled ? "text-emerald-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Two-Factor Authentication</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {enabled ? (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> Enabled
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Not enabled
                  </span>
                )}
              </p>
            </div>
          </div>

          {!enabled && !showSetup && (
            <button
              onClick={handleSetup}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Enable
            </button>
          )}

          {enabled && !showDisable && (
            <button
              onClick={() => setShowDisable(true)}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
            >
              Disable
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Add an extra layer of security by requiring a code from an authenticator app (Google Authenticator, Authy, etc.) when logging in.
        </p>

        {showSetup && setupData && (
          <div className="mt-5 border-t border-border/50 pt-5 space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium text-foreground mb-3">
                Scan this QR code with your authenticator app
              </p>
              <div className="inline-block bg-white p-3 rounded-xl">
                <img src={setupData.qrCode} alt="2FA QR Code" className="w-48 h-48" />
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Or enter this code manually:</p>
              <p className="font-mono text-xs text-foreground break-all select-all">{setupData.secret}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Enter the 6-digit code from your app to verify
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground text-center tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-sm"
                />
                <button
                  onClick={handleVerify}
                  disabled={verifying || verifyCode.length !== 6}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {verifying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Verify
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setShowSetup(false);
                setSetupData(null);
                setVerifyCode("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {showDisable && (
          <div className="mt-5 border-t border-border/50 pt-5 space-y-3">
            <p className="text-sm text-foreground">Enter your password to disable 2FA:</p>
            <div className="flex gap-2">
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Your password"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-sm"
              />
              <button
                onClick={handleDisable}
                disabled={disabling || !disablePassword}
                className="px-5 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {disabling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Disable
              </button>
            </div>
            <button
              onClick={() => {
                setShowDisable(false);
                setDisablePassword("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {enabled && (
        <div className="bg-card border border-border/60 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Verification Frequency</h2>
          <p className="text-xs text-muted-foreground mb-4">
            How often should you be asked for a verification code
          </p>
          <div className="space-y-2">
            {FREQUENCY_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleFrequencyChange(value)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all text-sm ${
                  frequency === value
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                }`}
              >
                <span className="font-medium">{label}</span>
                {frequency === value && (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
