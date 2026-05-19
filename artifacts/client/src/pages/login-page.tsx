import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

interface LoginPageProps {
  ssoError?: string | null;
}

const ADMIN_EMAIL = "ervis.q@scopicsoftware.com";

const ERROR_MESSAGES: Record<string, string> = {
  email_not_verified: "Your Scopic email isn't verified yet. Please verify it in Keycloak and try again.",
  wrong_domain: "Only @scopicsoftware.com accounts can sign in.",
  sso_state_missing: "Your sign-in session expired. Please try again.",
  sso_state_invalid: "Your sign-in session expired. Please try again.",
  sso_missing_claims: "Sign-in didn't return the required account info. Contact IT.",
  sso_failed: "Sign-in failed. Please try again.",
};

const RETRY_DELAYS_MS = [5000, 10000, 20000, 40000, 60000];

export default function LoginPage({ ssoError }: LoginPageProps) {
  const baseUrl = useMemo(() => import.meta.env.BASE_URL.replace(/\/$/, ""), []);
  const loginUrl = `${baseUrl}/api/auth/keycloak/login`;
  const healthUrl = `${baseUrl}/api/auth/keycloak/health`;

  const isOutage = ssoError === "sso_unavailable";
  const errorMessage = ssoError && !isOutage
    ? ERROR_MESSAGES[ssoError] || "Sign-in failed. Please try again."
    : null;

  const [recovered, setRecovered] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!isOutage || recovered) return;

    let cancelled = false;
    const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];

    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      setChecking(true);
      try {
        const res = await fetch(healthUrl, { credentials: "same-origin" });
        if (cancelled) return;
        if (res.ok) {
          setRecovered(true);
        } else {
          setAttempt((a) => a + 1);
        }
      } catch {
        if (!cancelled) setAttempt((a) => a + 1);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOutage, attempt, recovered, healthUrl]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BrandLogo variant="full" size="xl" className="mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-foreground">Welcome to Scopic Chat</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in with your Scopic account to continue.
          </p>
        </div>

        {isOutage && !recovered && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-left"
            data-testid="sso-outage-card"
          >
            <h2 className="text-base font-semibold text-foreground">
              Single sign-on is currently unavailable
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We can't reach the Scopic SSO service right now, so sign-in is
              temporarily disabled. This is usually resolved within a few minutes.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              If it keeps happening, contact your admin:{" "}
              <a
                href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent("Scopic Chat SSO outage")}`}
                className="font-medium text-primary hover:underline"
              >
                {ADMIN_EMAIL}
              </a>
              .
            </p>
            <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
              {checking ? "Checking SSO status…" : "We'll keep checking automatically."}
            </p>
          </div>
        )}

        {isOutage && recovered && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-left"
            data-testid="sso-recovered-card"
          >
            <h2 className="text-base font-semibold text-foreground">
              SSO is back online
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You can sign in again now.
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
            {errorMessage}
          </div>
        )}

        <a
          href={loginUrl}
          className={`w-full block text-center py-3 rounded-xl font-medium transition-colors text-[15px] ${
            isOutage && !recovered
              ? "bg-muted text-muted-foreground pointer-events-none opacity-60"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
          aria-disabled={isOutage && !recovered ? true : undefined}
          tabIndex={isOutage && !recovered ? -1 : undefined}
        >
          {isOutage && !recovered ? "Sign-in unavailable" : "Sign in with Scopic SSO"}
        </a>

        <p className="text-center text-xs text-muted-foreground mt-6">
          You'll be redirected to auth.scopicsoftware.com to sign in.
        </p>
      </div>
    </div>
  );
}
