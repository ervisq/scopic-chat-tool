import { useMemo } from "react";
import { BrandLogo } from "@/components/brand-logo";

interface LoginPageProps {
  ssoError?: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  email_not_verified: "Your Scopic email isn't verified yet. Please verify it in Keycloak and try again.",
  wrong_domain: "Only @scopicsoftware.com accounts can sign in.",
  sso_state_missing: "Your sign-in session expired. Please try again.",
  sso_state_invalid: "Your sign-in session expired. Please try again.",
  sso_missing_claims: "Sign-in didn't return the required account info. Contact IT.",
  sso_unavailable: "Single sign-on is temporarily unavailable. Try again in a moment.",
  sso_failed: "Sign-in failed. Please try again.",
};

export default function LoginPage({ ssoError }: LoginPageProps) {
  const baseUrl = useMemo(() => import.meta.env.BASE_URL.replace(/\/$/, ""), []);
  const loginUrl = `${baseUrl}/api/auth/keycloak/login`;

  const errorMessage = ssoError ? ERROR_MESSAGES[ssoError] || "Sign-in failed. Please try again." : null;

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

        {errorMessage && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
            {errorMessage}
          </div>
        )}

        <a
          href={loginUrl}
          className="w-full block text-center py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors text-[15px]"
        >
          Sign in with Scopic SSO
        </a>

        <p className="text-center text-xs text-muted-foreground mt-6">
          You'll be redirected to auth.scopicsoftware.com to sign in.
        </p>
      </div>
    </div>
  );
}
