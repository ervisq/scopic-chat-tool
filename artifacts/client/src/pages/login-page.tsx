import { useState } from "react";
import { ShieldCheck, ArrowLeft, Mail } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "@/hooks/use-toast";

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string; requires2fa?: boolean }>;
  onRegister: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string; field?: string }>;
  onVerify2fa: (code: string) => Promise<{ success: boolean; error?: string }>;
  onCancel2fa: () => void;
  isLoading: boolean;
  requires2fa: boolean;
  initialMode?: "login" | "register" | "forgot";
}

type Mode = "login" | "register" | "forgot";
type FieldErrors = { email?: string; password?: string; name?: string };

const ALLOWED_DOMAIN = "@scopicsoftware.com";

function inferFieldFromMessage(msg: string): keyof FieldErrors | null {
  const lower = msg.toLowerCase();
  if (lower.includes("scopicsoftware.com") || lower.includes("email") && (lower.includes("domain") || lower.includes("allowed"))) return "email";
  if (lower.includes("already exists")) return "email";
  if (lower.includes("password") && lower.includes("6")) return "password";
  if (lower.includes("name")) return "name";
  return null;
}

export default function LoginPage({
  onLogin, onRegister, onVerify2fa, onCancel2fa, isLoading, requires2fa,
  initialMode = "login",
}: LoginPageProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [totpCode, setTotpCode] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const setFieldError = (field: keyof FieldErrors, msg: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: msg }));
  };

  const clearFieldErrors = () => setFieldErrors({});

  const validateRegisterClientSide = (): { ok: boolean; topMessage?: string } => {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Please enter your full name";
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      next.email = "Email is required";
    } else if (!normalized.endsWith(ALLOWED_DOMAIN)) {
      next.email = `Use your ${ALLOWED_DOMAIN} email`;
    }
    if (!password) {
      next.password = "Password is required";
    } else if (password.length < 6) {
      next.password = "Use at least 6 characters";
    }
    setFieldErrors(next);
    if (Object.keys(next).length === 0) return { ok: true };
    const first = next.email || next.password || next.name;
    return { ok: false, topMessage: first };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    clearFieldErrors();

    if (mode === "register") {
      const local = validateRegisterClientSide();
      if (!local.ok) {
        setError(local.topMessage || "Please fix the errors below");
        return;
      }
      const result = await onRegister(email, password, name);
      if (!result.success) {
        const msg = result.error || "Registration failed";
        setError(msg);
        const field = (result.field as keyof FieldErrors | undefined) || inferFieldFromMessage(msg);
        if (field) setFieldError(field, msg);
      } else {
        const firstName = name.trim().split(/\s+/)[0] || "there";
        toast({ title: `Welcome, ${firstName}!` });
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
    clearFieldErrors();
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

  const tabBase = "flex-1 py-2 text-sm font-medium rounded-lg transition-colors text-center";
  const tabActive = "bg-card text-primary shadow-sm";
  const tabInactive = "text-muted-foreground hover:text-foreground";

  const inputBase = "w-full px-3 py-2.5 rounded-xl border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all text-[15px]";
  const inputOk = "border-border focus:ring-primary/20 focus:border-primary/40";
  const inputErr = "border-destructive/60 focus:ring-destructive/20 focus:border-destructive";

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <BrandLogo variant="full" size="xl" className="mx-auto mb-6" />
        </div>

        <div
          role="tablist"
          aria-label="Sign in or create account"
          className="flex p-1 rounded-xl bg-muted/60 border border-border mb-6"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!isRegister}
            onClick={() => goToMode("login")}
            className={`${tabBase} ${!isRegister ? tabActive : tabInactive}`}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isRegister}
            onClick={() => goToMode("register")}
            className={`${tabBase} ${isRegister ? tabActive : tabInactive}`}
          >
            Create account
          </button>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {isRegister ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRegister
              ? "@scopicsoftware.com emails only · password ≥ 6 characters"
              : "Sign in to your dashboard"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
                }}
                placeholder="Your full name"
                required
                aria-invalid={!!fieldErrors.name}
                className={`${inputBase} ${fieldErrors.name ? inputErr : inputOk}`}
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>
              )}
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
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
              }}
              placeholder={isRegister ? "you@scopicsoftware.com" : "you@company.com"}
              required
              aria-invalid={!!fieldErrors.email}
              className={`${inputBase} ${fieldErrors.email ? inputErr : inputOk}`}
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.email}</p>
            )}
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
              }}
              placeholder={isRegister ? "At least 6 characters" : "Enter your password"}
              required
              minLength={6}
              aria-invalid={!!fieldErrors.password}
              className={`${inputBase} ${fieldErrors.password ? inputErr : inputOk}`}
            />
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.password}</p>
            )}
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
