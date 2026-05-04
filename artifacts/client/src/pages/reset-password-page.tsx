import { useState, useEffect } from "react";
import { ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

interface ResetPasswordPageProps {
  token: string;
  onDone: () => void;
  onRequestNewLink: () => void;
}

type Status = "form" | "submitting" | "success" | "error";

export default function ResetPasswordPage({ token, onDone, onRequestNewLink }: ResetPasswordPageProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("form");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("This reset link is missing a token. Please request a new one.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setStatus("submitting");
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setError(data.message || "Couldn't reset your password. Please try again.");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Network error. Please check your connection and try again.");
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <BrandLogo variant="full" size="xl" className="mx-auto mb-6" />
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Password updated</h1>
            <p className="text-sm text-muted-foreground mt-2">
              You can now sign in with your new password.
            </p>
          </div>
          <button
            type="button"
            onClick={onDone}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors text-[15px]"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  if (status === "error" && !token) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <BrandLogo variant="full" size="xl" className="mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-foreground">Invalid link</h1>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
          </div>
          <button
            type="button"
            onClick={onRequestNewLink}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors text-[15px]"
          >
            Request a new reset link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BrandLogo variant="full" size="xl" className="mx-auto mb-6" />
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set a new password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a password with at least 6 characters.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-foreground mb-1.5">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-[15px]"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-1.5">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-[15px]"
            />
          </div>

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[15px]"
          >
            {status === "submitting" ? "Updating..." : "Update password"}
          </button>

          {status === "error" && (
            <button
              type="button"
              onClick={onRequestNewLink}
              className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Request a new reset link instead
            </button>
          )}
        </form>

        <button
          type="button"
          onClick={onDone}
          className="flex items-center gap-1.5 mx-auto mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </button>
      </div>
    </div>
  );
}
