import { useState } from "react";
import { ShieldCheck, ArrowLeft, Mail } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string; requires2fa?: boolean }>;
  onRegister: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  onVerify2fa: (code: string) => Promise<{ success: boolean; error?: string }>;
  onCancel2fa: () => void;
  isLoading: boolean;
  requires2fa: boolean;
  initialMode?: "login" | "register" | "forgot";
}

type Mode = "login" | "register" | "forgot";

export default function LoginPage({
  onLogin, onRegister, onVerify2fa, onCancel2fa, isLoading, requires2fa,
  initialMode = "login",
}: LoginPageProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "register") {
      if (!name.trim()) {
        setError("Name is required");
        return;
      }
      const result = await onRegister(email, password, name);
      if (!result.success) {
        setError(result.error || "Registration failed");
      }
    } else {
      const result = await onLogin(email, password);
      if (!result.success) {
        setError(result.error || "Login failed");
      }
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    setForgotSubmitting(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).catch(() => null);
    } finally {
      // Always show the generic confirmation panel, regardless of whether the
      // request succeeded, failed, or the network was offline. This matches
      // the server's intentionally-uniform response and prevents account
      // enumeration via UI state differences.
      setForgotSent(true);
      setForgotSubmitting(false);
    }
  };

  const handle2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!totpCode || totpCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    const result = await onVerify2fa(totpCode);
    if (!result.success) {
      setError(result.error || "Verification failed");
    }
  };

  const goToMode = (next: Mode) => {
    setMode(next);
    setError("");
    setForgotSent(false);
  };

  if (requires2fa) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <BrandLogo variant="full" size="xl" className="mx-auto mb-6" />
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Two-Factor Authentication
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <form onSubmit={handle2faSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="totp-code" className="block text-sm font-medium text-foreground mb-1.5">
                Verification Code
              </label>
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                autoFocus
                required
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-[15px] text-center tracking-[0.5em] font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || totpCode.length !== 6}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[15px]"
            >
              {isLoading ? "Verifying..." : "Verify"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setTotpCode("");
              setError("");
              onCancel2fa();
            }}
            className="flex items-center gap-1.5 mx-auto mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </button>
        </div>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <BrandLogo variant="full" size="xl" className="mx-auto mb-6" />
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Forgot your password?</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {forgotSent
                ? "Check your inbox for a reset link."
                : "Enter your email and we'll send you a reset link."}
            </p>
          </div>

          {forgotSent ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm text-foreground">
                If an account with <span className="font-medium">{email}</span> exists,
                we've sent a reset link. The link expires in 1 hour.
              </div>
              <button
                type="button"
                onClick={() => goToMode("login")}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors text-[15px]"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-foreground mb-1.5">
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@scopicsoftware.com"
                  required
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-[15px]"
                />
              </div>

              <button
                type="submit"
                disabled={forgotSubmitting}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[15px]"
              >
                {forgotSubmitting ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => goToMode("login")}
            className="flex items-center gap-1.5 mx-auto mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  const isRegister = mode === "register";

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BrandLogo variant="full" size="xl" className="mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-foreground">
            {isRegister ? "Create account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRegister ? "Sign up to get started" : "Sign in to your dashboard"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {isRegister && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-[15px]"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-[15px]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              {!isRegister && (
                <button
                  type="button"
                  onClick={() => goToMode("forgot")}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegister ? "Create a password" : "Enter your password"}
              required
              minLength={6}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-[15px]"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[15px]"
          >
            {isLoading
              ? isRegister ? "Creating account..." : "Signing in..."
              : isRegister ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => goToMode(isRegister ? "login" : "register")}
            className="text-primary hover:underline font-medium"
          >
            {isRegister ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </div>
  );
}
